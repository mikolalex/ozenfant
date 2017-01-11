var ozenfant_config = require('./config');
var parser = require('../ooo_oo_o/parser').get_parser(ozenfant_config);

var init_if_empty = function(obj/*key, val, key1, val1, ... */) {
	for(let i  = 1; ;i = i + 2){
		var key = arguments[i];
		var val = arguments[i + 1];
		if(!key) break;

		if(obj[key] === undefined){
			obj[key] = val;
		}
		obj = obj[key];
	}
	return obj;
}

var html_attrs = new Set(['href', 'src', 'style', 'target', 'id', 'class', 'rel', 'type', 'value'])
var is_attr = (str) => {
	return html_attrs.has(str) || str.match(/^data\-/);
}

var text_var_regexp = /\{\{([a-zA-Z0-9]*)\}\}/g;///\$([a-zA-Z0-9]*)/g;

var Ozenfant = function(str){
	if(str instanceof Object){
		this.struct = str;// compiled struct
		this.node_vars_paths = this.struct.node_vars_paths;
		this.text_vars_paths = this.struct.text_vars_paths;
		this.nodes_vars = this.struct.nodes_vars;
		this.var_types = this.struct.var_types;
		this.varname_pool = this.struct.varname_pool;
		this.if_else_tree = this.struct.if_else_tree;
	} else {
		this.struct = parser(str + `
`);
		this.node_vars_paths = {};
		this.text_vars_paths = {};
		this.nodes_vars = {};
		this.var_types = {};
		this.varname_pool = {
			vars: {},
			var_aliases: {},
		};
		this.func = create_func(toFunc({children: this.struct.semantics}));
		this.if_else_tree = {str_to_func: {}, var_funcs: {}};
		get_vars({children: this.struct.semantics, root: true}
			, this.node_vars_paths
			, this.text_vars_paths
			, this.nodes_vars
			, '.'
			, this.var_types
			, []
			, this.varname_pool
			, this.if_else_tree
		);
	}
	this.state = {};
	this.bindings = {};

	this.getIfElseVarsIndex();
};

var create_func = (str, condition) => {
	var body = "'" + str + "'";
	if(condition){
		body = condition + ' ? ' + body + ' : false';
	}
	return new Function('ctx', 'var res = []; var res2 = []; res.push(' + body + '); return res.join("");');
}

Ozenfant.prepare = (str) => {
	var struct = parser(str + `
`);
	struct.node_vars_paths = {};
	struct.text_vars_paths = {};
	struct.nodes_vars = {};
	struct.var_types = {};
	struct.varname_pool = {
		vars: {},
		var_aliases: {},
	};
	struct.func = create_func(toFunc({children: struct.semantics}));
	//console.log('Struct func', struct.func);
	struct.if_else_tree = {str_to_func: {}, var_funcs: {}};
	get_vars({children: struct.semantics, root: true}
		, struct.node_vars_paths
		, struct.text_vars_paths
		, struct.nodes_vars
		, '.'
		, struct.var_types
		, []
		, struct.varname_pool
		, struct.if_else_tree
	);
	
	return struct;
}

var get_varname = (node) => {
	var key = node.varname;
	if(!key.length){
		if(node.classnames){
			key = node.classnames.substr(1).split('.')[0];
		} else {
			console.warn('Incorrect statement: variable without name and default class!');
		}
	}
	return key;
}

var register_varname = (varname, varname_pool, if_else_deps, if_else_tree) => {
	if(varname_pool.vars[varname]){
		// already exists!
		init_if_empty(varname_pool.var_aliases, varname, []);
		var new_name = 'ololo@!@!#_' + varname + '_' + varname_pool.var_aliases[varname].length;
		varname_pool.var_aliases[varname].push(new_name);
		varname = new_name;
	} else {
		varname_pool.vars[varname] = true;
	}
	var deps = if_else_deps.length ? ('(' + if_else_deps.join(') && (') + ')') : false;
	if(deps){
		if(if_else_tree.str_to_func[deps]){
			if_else_tree.var_funcs[varname] = if_else_tree.str_to_func[deps];
		} else {
			if_else_tree.var_funcs[varname] = if_else_tree.str_to_func[deps] = new Function('ctx', 'return ' + deps);
		}
	}
	return varname;
}

var add_to_if_else_pool = (pools, varname, path) => {
	for(var pool of pools){
		pool[varname] = path;
	}
}

var is_new_if = (a) => {
	return ['NEW_ELSE', 'NEW_ELSEIF', 'NEW_IF'].indexOf(a.type) !== -1;
}

var get_partial_func = (node) => {
	if(node.partial_func) {
		return node.partial_func;
	} else {
		if(node.root){
			return 'USE_ROOT_FUNC';
		}
	}
	
}

var get_vars = (node, node_pool, text_pool, path_pool, path, types, if_else_deps, varname_pool, if_else_tree) => {
	//if_else_deps = [...if_else_deps];
	if(node.children){
		var nodes_lag = 0;
		var text_lag = 0;
		var resigtered_vars = {};
		for(var i in node.children){
			var zild = node.children[i];
			var new_path = path;
			if(!is_new_if(zild)){
				if(!zild.tagname && !zild.classnames){
						++nodes_lag;
				} else {
						++text_lag;
				}
				new_path = path + '/*[' + (Number(i) + 1 - nodes_lag) + ']';
			}
			if(zild.type && (
					zild.type === 'ELSE' 
					|| zild.type === 'IF'
					|| zild.type === 'NEW_IF'
					|| zild.type === 'NEW_ELSEIF'
					|| zild.type === 'NEW_ELSE')){
				if(zild.type === 'NEW_IF'){
					var varname = register_varname(get_varname(zild), varname_pool, if_else_deps, if_else_tree);
					resigtered_vars[varname] = true;
					node_pool[varname] = new_path;
					types[varname] = get_partial_func(node);
					var my_if_else_deps = [...if_else_deps];
					my_if_else_deps.push(zild.expr)
					get_vars(zild, node_pool, text_pool, path_pool, new_path, types, my_if_else_deps, varname_pool, if_else_tree);
					continue;
				}
				if(zild.type === 'NEW_ELSEIF' || zild.type === 'NEW_ELSE'){
					var varname = get_varname(zild);
					if(!resigtered_vars[varname]){
						register_varname(varname, varname_pool, if_else_deps, if_else_tree);
					}
					types[varname] = get_partial_func(node);
					node_pool[varname] = new_path;
					var my_if_else_deps = [...if_else_deps];
					my_if_else_deps.push(zild.real_expr)
					get_vars(zild, node_pool, text_pool, path_pool, new_path, types, my_if_else_deps, varname_pool, if_else_tree);
					continue;
				}
				if(zild.type === 'ELSE'){
					return;
				}
				if(zild.type === 'IF'){
					var varname = register_varname(get_varname(zild), varname_pool, if_else_deps, if_else_tree);
					node_pool[varname] = new_path;
					types[varname] = {
						type: 'IF',
						struct: zild,
						if_pool,
						else_pool,
					};
					get_vars(zild, node_pool, text_pool, path_pool, new_path, types, [...if_else_deps], varname_pool, if_else_tree);
					if(zild.else_children){
						get_vars(zild.else_children, node_pool, text_pool, path_pool, new_path, types, [...if_else_deps], varname_pool, if_else_tree);
					}
				} else {
					get_vars(zild, node_pool, text_pool, path_pool, new_path, types, if_else_deps, varname_pool, if_else_tree);
				}
			} else {
				if(zild.varname !== undefined){
					var varname = register_varname(get_varname(zild), varname_pool, if_else_deps, if_else_tree);
					node_pool[varname] = new_path;
				}
				if(zild.attrStyleVars){
					for(let [varname, attrname] of zild.attrStyleVars){
						varname = register_varname(varname, varname_pool, if_else_deps, if_else_tree);
						node_pool[varname] = new_path;
						let as_type = is_attr(attrname) ? 'ATTR' : 'STYLE';
						types[varname] = {
							type: as_type,
							name: attrname,
						}
					}
					get_vars(zild, node_pool, text_pool, path_pool, new_path, types, [...if_else_deps], varname_pool, if_else_tree);
				} 
				if(zild.quoted_str){
					//console.log('str!', node.children[i].quoted_str);
					zild.quoted_str.replace(text_var_regexp, (_, key) => {
						var text_path = path + '/text()[' + (Number(i) + 1 - text_lag) + ']';
						varname = register_varname(key, varname_pool, if_else_deps, if_else_tree);
						if(!path_pool[text_path]){
							path_pool[text_path] = zild.quoted_str;
						}
						text_pool[varname] = text_path;
						//console.log('text key found', key, text_path);
					})
				} 
				get_vars(zild, node_pool, text_pool, path_pool, new_path, types, [...if_else_deps], varname_pool, if_else_tree);
			}
		}
	}
}

var input_types = new Set(['text', 'submit', 'checkbox', 'radio']);

var toHTML = function(node, context, parent_tag){
	var indent = `
` + new Array(node.level).join('	');
	//indent = '';// !
	var res1 = [], res2 = [], after = '';
	if(node.type === 'ELSE'){
		return '';
	}
	var childs = node.children;
	if(node.type === 'IF'){
		if(!context[node.varname]){
			// "ELSE" part
			if(node.else_children){
				childs = node.else_children.children;
			} else {
				childs = [];
			}
		}
	}
	if(node.tagname || node.classnames || !parent_tag){
		// it's a node
		var tag;
		if(node.tagname){
			if(input_types.has(node.tagname)) {
				node.assignments = node.assignments || [];
				node.assignments.push(['type', node.tagname]);
				tag = 'input';
			} else {
				tag = node.tagname;
			}
		} else {
			switch(parent_tag){
				case 'ol':
				case 'ul':
					tag = 'li';
				break;
				case 'tr':
					tag = 'td';
				break;
				default:
					tag = 'div';
				break;
			}
		}
		for(let child of childs){
			res1.push(toHTML(child, context, tag));
		}
		if(parent_tag){
			res2.push(indent + '<' + tag);
			if(node.classnames && node.classnames.length > 1){
				res2.push(' class="' + node.classnames.substr(1).replace(/\./g, " ") + '"');
			}
			if(node.assignments){
				var styles = [];
				for(let ass of node.assignments){
					var [key, val] = ass;
					if(val[0] === '$'){
						// its variable, lets take its val from context
						var real_key = val.length === 1 ? key : val.substr(1);
						val = context[real_key] !== undefined ? context[real_key] : '';
					}
					if(is_attr(key)){
						res2.push(' ' + key + '="' + val + '"');
					} else {
						styles.push(key + ': ' + val + ';');
					}
				}
				if(styles.length){
					res2.push(' style="' + styles.join('') + '"');
				}
			}
			res2.push('>');
			if(node.varname !== undefined && !node.type){
				var key = get_varname(node);
				res2.push(indent + '	' + (context[key] !== undefined ? context[key] : ''));
			} else {
				res2.push(res1.join(' '));
			}
			res2.push(indent + '</' + tag + '>');
			return res2.join('');
		}
	} else {
		// its var of text node
		if(node.quoted_str){
			return indent + node.quoted_str.replace(text_var_regexp, function(_, key){
				//console.log('Found!', key, context[key]);
				return context[key] !== undefined ? context[key] : '';
			});
		}
		if(node.variable){
			return indent + node.variable;
		}
	}
	return res1.join(' ');
}

var getvar = (key) => {
	return "' + (ctx." + key + " || '') + '";
}
var getvar_raw = (key) => {
	return "' + (" + key + " || '') + '";
}

var get_children_html = (childs, parent_tag, if_stack, pp, loop_level) => {
	var res1 = [];
	for(let child of childs){
		res1.push(toFunc(child, parent_tag, if_stack, pp, loop_level));
	}
	return res1.join('');
}

var toFuncVarname = (a) => {
	var dot_counter = 0;
	for(var cp in a){
		if(a[cp] === '.'){
			++dot_counter;
		} else {
			break;
		}
	}
	if(dot_counter){
		a = '__loopvar' + dot_counter + '.' + a.substr(dot_counter);
	} else {
		a = 'ctx.' + a;
	}
	return a;
}

var toFunc = function(node, parent_tag, if_stack = {}, partial_pool = false, loop_level = 0){
	if(node.loop){
		++loop_level;
	}
	node.parent = parent;
	var childs = node.children;
	var indent = ` ' + 
'` + new Array(node.level).join('	');
	//indent = '';// !
	var res1 = [], res2 = [], after = '', res_final;
	var childs_html = '';
	var need_partial_func = false;
	var pp = false;
	for(let child of childs){
		if(is_new_if(child)){
			need_partial_func = true;
			pp = [];
			break;
		}
	}
	if(node.type === 'ELSE' || is_new_if(node)){
		switch(node.type){
			case 'ELSE':
				res1.push(indent + "' + (!ctx." + toFuncVarname(node.varname) + " ? ('");
				childs_html = get_children_html(childs, parent_tag, if_stack, pp, loop_level);
				res1.push(childs_html);
				res1.push(indent + "') : '' ) + '");
				res1.push(node.after);
			break;
			case 'NEW_IF':
				//console.log('IF STACK', if_stack);
				if_stack[node.level] = [toFuncVarname(node.varname), node.expr, []];
				res1.push(indent + "' + (" + node.expr + " ? ('");
				childs_html = get_children_html(childs, parent_tag, if_stack, pp, loop_level);
				res1.push(childs_html);
				res1.push(indent + "') : '' ) + '");
			break;
			case 'NEW_ELSEIF':
				var [varname, expr, elifs] = if_stack[node.level];
				if_stack[node.level][2].push(node.expr);
				node.real_expr = node.expr + " && !(" + expr + ")";
				res1.push(indent + "' + ((" + node.expr + " && !(" + expr + ")) ? ('");
				childs_html = get_children_html(childs, parent_tag, if_stack, pp, loop_level);
				res1.push(childs_html);
				res1.push(indent + "') : '' ) + '");
			break;
			case 'NEW_ELSE':
				var [varname, expr, elifs] = if_stack[node.level];
				node.varname = varname;
				node.real_expr = "!(" + expr + "" + (elifs.length ? ' || ' + elifs.join(' || ') : '') + ")";
				res1.push(indent + "' + (!(" + expr + "" + (elifs.length ? ' || ' + elifs.join(' || ') : '') + ") ? ('");
				childs_html = get_children_html(childs, parent_tag, if_stack, pp, loop_level);
				res1.push(childs_html);
				res1.push(indent + "') : '' ) + '");
			break;
		}
	} else if (node.tagname || node.classnames || !parent_tag || node.type === 'IF'){
		// it's a node
		var tag;
		if(node.tagname){
			if(input_types.has(node.tagname)) {
				node.assignments = node.assignments || [];
				node.assignments.push(['type', node.tagname]);
				tag = 'input';
			} else {
				tag = node.tagname;
			}
		} else {
			switch(parent_tag){
				case 'ol':
				case 'ul':
					tag = 'li';
				break;
				case 'tr':
					tag = 'td';
				break;
				default:
					tag = 'div';
				break;
			}
		}
		
		if(node.type === 'IF'){
			if(node.else_children){
				node.else_children.varname = node.varname;
			}
			res1.push(indent + "' + (ctx." + node.varname + " ? ('");
			for(let child of childs){
				res1.push(toFunc(child, tag, if_stack, pp, loop_level));
			}
			res1.push(indent + "') : '' ) + '");
		} else {
			childs_html = get_children_html(childs, tag, if_stack, pp, loop_level);
			res1.push(childs_html);
		}
		if(parent_tag){
			res2.push(indent + '<' + tag);
			if(node.classnames && node.classnames.length > 1){
				res2.push(' class="' + node.classnames.substr(1).replace(/\./g, " ") + '"');
			}
			if(node.assignments){
				var styles = [];
				for(let ass of node.assignments){
					var [key, val] = ass;
					if(val[0] === '$'){
						// its variable, lets take its val from context
						var real_key = val.length === 1 ? key : val.substr(1);
						real_key = toFuncVarname(real_key);
						val = getvar_raw(real_key);
					}
					if(is_attr(key)){
						res2.push(' ' + key + '="' + val + '"');
					} else {
						styles.push(key + ': ' + val + ';');
					}
				}
				if(styles.length){
					res2.push(' style="' + styles.join('') + '"');
				}
			}
			res2.push('>');
			if(node.varname !== undefined && !node.type){
				var key = get_varname(node);
				res2.push(indent + getvar(key));
			} else {
				if(node.loop){
					var loopvar = toFuncVarname(node.loop);
					res2.push(`'); 
					for(var ___k` + loop_level + ` in ` + loopvar + `) { 
						var __loopvar` + loop_level + ` = ` + loopvar + `[___k` + loop_level + `]; 
						res.push('` + childs_html + `'); 
					} 
					res.push('`);
				} else {
					res2.push(res1.join(' '));
				}
			}
			if(node.type === 'IF' && node.else_children){
				node.else_children.after = indent + '</' + tag + '>';
			} else {
				res2.push(indent + '</' + tag + '>');
			}
			res_final = res2.join('');
		}
	} else {
		// its var of text node
		if(node.quoted_str){
			res_final = indent + node.quoted_str.replace(text_var_regexp, function(_, key){
				//console.log('Found!', key, context[key]);
				return "' + ctx." + key + " + '";
			});
		}
		if(node.variable){
			res_final = indent + node.variable;
		}
	}
	res_final = res_final || res1.join('');
	if(need_partial_func){
		if(partial_pool){
			partial_pool.push(node);
			if(pp){
				for(let nd of pp){
					partial_pool.push(nd);
				}
			}
		} else {
			node.partial_func = create_func(childs_html);
			if(pp){
				for(let nd of pp){
					nd.partial_func = node.partial_func;
				}
			}
		}
	}
	return res_final;
}

Ozenfant.prototype.toHTML = function(context){
	if(context){
		this.state = context;
	} else {
		context = {};
	}
	if(!this.struct.func){
		var func_body = " return '" + toFunc({children: this.struct.semantics, root: true}) + "';";
		this.struct.func = new Function('ctx', func_body);
	}
	var a = this.struct.func(context);
	//var a = toHTML({children: this.struct.semantics}, context = context);
	return a;
}

Ozenfant.prototype.searchByPath = function(path){
	return Ozenfant.xpOne(path, this.root);
}

Ozenfant.prototype.getIfElseVarsIndex = function(){
	this.if_else_vars = {};
	for(var one in this.var_types){
		if(!(this.var_types[one] instanceof Object)) continue;
		for(var varname in this.var_types[one].if_pool){
			var path = this.var_types[one].if_pool[varname];
			init_if_empty(this.if_else_vars, varname, {}, one, true);
		}
		for(var varname in this.var_types[one].else_pool){
			var path = this.var_types[one].if_pool[varname];
			init_if_empty(this.if_else_vars, varname, {}, one, false);
		}
		for(var varname in this.var_types[one].my_pool){
			var path = this.var_types[one].my_pool[varname];
			var expr = this.var_types[one].struct.real_expr || this.var_types[one].struct.expr;
			init_if_empty(this.if_else_vars, varname, {}, one, expr);
		}
	}
}

Ozenfant.prototype.updateBindings = function(){
	this.bindings = {};
	for(let varname in this.node_vars_paths){
		if(this.if_else_vars[varname]){
			var breaker = false;
			for(let vn in this.if_else_vars[varname]){
				var expected_val = this.if_else_vars[varname][vn];
				var real_val = this.state[vn];
				// XOR
				if(!((expected_val && real_val) || !(expected_val || real_val))){
					breaker = true;
					break;
				}
			}
			if(breaker) { 
				continue;
			}
		}
		this.bindings[varname] = this.searchByPath(this.node_vars_paths[varname]);
		if(!this.bindings[varname]){
			//console.warn('No node found for var', varname, 'in path:', this.node_vars_paths[varname], 'in context', this.root, ', context', this.state);
		}
	}
	for(let varname in this.text_vars_paths){
		this.bindings[varname] = this.searchByPath(this.text_vars_paths[varname]);
		if(!this.bindings[varname]){
			console.warn('No node found for path:', this.text_vars_paths[varname], 'in context', this.root);
		}
	}
}
Ozenfant.prototype.render = function(node, context = false){
	this.root = node;
	if(context){
		this.state = context;
	}
	node.innerHTML = this.toHTML(this.state);
	this.updateBindings();
}
Ozenfant.prototype.getTokenStruct = function(node, level = 1){
	var start = !node;
	if(!node){
		node = this.struct.syntax;
	}
	var arr = [new Array(level).join('	') + node.type];
	if(node.children){
		for(var child of node.children){
			arr.push(this.getTokenStruct(child, level + 1));
		}
	}
	return (start ? `
` : '') + arr.join(`
`);
}

Ozenfant.prototype.getHTML = function(context = false){
	if(context) { 
		this.state = context;
	}
	return this.toHTML(this.state);
}
Ozenfant.prototype.setRoot = function(node){
	this.root = node;
	return this;
}
Ozenfant.prototype._setVarVal = function(key, val){
	if(this.if_else_vars[key]){
		//console.log('ifelsevar', key, this.if_else_vars[key]);
		for(var varname in this.if_else_vars[key]){
			var flag = this.if_else_vars[key][varname] ? this.state[varname] : !this.state[varname];
			if(!flag) {
				// this var is in inactive block
				return;
			}
		}
	}
	if(val instanceof Object) return;
	this.bindings[key].textContent = val;
}
Ozenfant.prototype.set = function(key, val){
	if(this.state[key] === val){
		return; 
	} 
	this.state[key] = val;
	if(this.varname_pool.var_aliases[key]){
		for(let k of this.varname_pool.var_aliases[key]){
			this.set(k, val);
		}
	}
	if(!this.bindings[key]){
		return;
	}
	if(!this.root) return;
	//console.log('path', this.text_vars_paths[key], 'vars', this.nodes_vars);
	if(this.if_else_tree.var_funcs[key]){
		//console.log('should check the func first!', key);
		if(!this.if_else_tree.var_funcs[key](this.state)){
			// no need to update anything in DOM - it's not an active branch
			return;
		}
	}
	if(this.nodes_vars[this.text_vars_paths[key]]){
		var template = this.nodes_vars[this.text_vars_paths[key]];
		//console.log('template!', template);
		var new_str = template.replace(text_var_regexp, (_, key) => {
			return this.state[key];
		});
		this._setVarVal(key, new_str);
		this.bindings[key].innerHTML = new_str;
	} else {
		if(this.var_types[key]){
			switch(this.var_types[key].type){
				case 'IF':
					var val;
					if(val){
						var struct = this.var_types[key].struct.children;
					} else {
						if(this.var_types[key].struct.else_children){
							var struct = this.var_types[key].struct.else_children.children;
						} else {
							this.updateBindings();
							return;
						}
					}
					var html = toHTML({children: struct}, this.state);
					this.bindings[key].innerHTML = html;
					// @todo should be optimized! update bindings only for dependent vars!
					this.updateBindings();
				break;
				case 'ATTR':
					this.bindings[key].setAttribute(this.var_types[key].name, val);
				break;
				case 'STYLE':
					this.bindings[key].style[this.var_types[key].name] = val;
				break;
				default:
					var func;
					if(this.var_types[key] === 'USE_ROOT_FUNC'){
						func = this.struct.func;
					}
					if(this.var_types[key] instanceof Function){
						func = this.var_types[key];
					}
					var html = func(this.state);
					//console.log('run func', func, 'of', key, 'val', val, /*'with state', JSON.stringify(this.state),*/ 'if_else_deps____html', html, 'to', this);
					this.bindings[key].innerHTML = html;
					this.updateBindings();
				break;
			}
		} else {
			this._setVarVal(key, val);
		}
	}
}
Ozenfant.xpOne = (path, node = document) => {
	//console.log('NODE', node);
	return document.evaluate(path, node, null, XPathResult.ANY_TYPE, null).iterateNext(); 
}

module.exports = Ozenfant;

