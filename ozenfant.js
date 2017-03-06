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

var last = (arr) => {
	return arr[arr.length - 1];
}

const toggle_class = (el, clas, val) => {
	const cls_string = el.getAttribute('class') || '';
	const cls = cls_string.split(' ');
	const pos = cls.indexOf(clas);
	var toggle;
	if(val !== undefined){
		toggle = val;
	} else {
		toggle = pos === -1;
	}
	if(toggle){
		if(cls.indexOf(clas) === -1){
			el.setAttribute('class', cls_string + ' ' + clas);
		}
	} else {
		if(pos !== -1){
			cls.splice(pos, 1);
		}
		el.setAttribute('class', cls.join(' '));
	}
}

var html_attrs = new Set(["accept","accept-charset","accesskey","action","align","alt","async","autocomplete","autofocus","autoplay","autosave","bgcolor","border","buffered","challenge","charset","checked","cite","class","code","codebase","color","cols","colspan","content","contenteditable","contextmenu","controls","coords","data","data-*","datetime","default","defer","dir","dirname","disabled","download","draggable","dropzone","enctype","for","form","formaction","headers","height","hidden","high","href","hreflang","http-equiv","icon","id","integrity","ismap","itemprop","keytype","kind","label","lang","language","list","loop","low","manifest","max","maxlength","media","method","min","multiple","muted","name","novalidate","open","optimum","pattern","ping","placeholder","poster","preload","radiogroup","readonly","rel","required","reversed","rows","rowspan","sandbox","scope","scoped","seamless","selected","shape","size","sizes","slot","span","spellcheck","src","srcdoc","srclang","srcset","start","step","style","summary","tabindex","target","title","type","usemap","value","width","wrap"])
var is_attr = (str) => {
	return html_attrs.has(str) || str.match(/^data\-/);
}

var traverse_tree = (root_node, cb, key = 'children') => {
	for(var b in root_node[key]){
		var leaf = root_node[key][b];
		cb(leaf);
		traverse_tree(leaf, cb, key);
	}
}

var text_var_regexp = /\{\{([a-zA-Z0-9\_]*)\}\}/g;///\$([a-zA-Z0-9]*)/g;

var Ozenfant = function(str){
	if(str instanceof Object){
		this.struct = str;// compiled struct
		this.node_vars_paths = this.struct.node_vars_paths;
		this.text_vars_paths = this.struct.text_vars_paths;
		this.nodes_vars = this.struct.nodes_vars;
		this.var_types = this.struct.var_types;
		this.varname_pool = this.struct.varname_pool;
		this.if_else_tree = this.struct.if_else_tree;
		this.loop_pool = this.struct.loop_pool;
		this.str = this.struct.str;
	} else {
		this.str = str;
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
		this.loop_pool = {};
		this.get_vars({children: this.struct.semantics, root: true}
			//, this.node_vars_paths
			//, this.text_vars_paths
			//, this.nodes_vars
			, '.'
			, this.var_types
			, []
			//, this.varname_pool
			//, this.if_else_tree
			, []
			//, this.loop_pool	
		);
	}
	this.state = {};
	this.bindings = {};

	this.getIfElseVarsIndex();
};

var create_func = (str, condition, loop_level) => {
	var body = "'" + str + "'";
	if(condition){
		body = condition + ' ? ' + body + ' : false';
	}
	var args = 'ctx';
	if(loop_level){
		for(var c = 1; c <= loop_level; c++){
			args += ', __loopvar' + c;
		}
	}
	const fbody = 'var res = []; var res2 = []; res.push(' + body + '); return res.join("");';
	return new Function(args, fbody);
}

Ozenfant.prepare = (str) => {
	var struct = Object.assign(Object.create(Ozenfant.prototype, {}), parser(str + `
`));
	struct.node_vars_paths = {};
	struct.text_vars_paths = {};
	struct.nodes_vars = {};
	struct.var_types = {};
	struct.varname_pool = {
		vars: {},
		var_aliases: {},
	};
	struct.func = create_func(toFunc({children: struct.semantics}));
	//console.log('Struct func', struct);
	struct.if_else_tree = {str_to_func: {}, var_funcs: {}};
	struct.loop_pool = {};
	struct.str = str;
	struct.get_vars(
		{children: struct.semantics, root: true}
		//, struct.node_vars_paths
		//, struct.text_vars_paths
		//, struct.nodes_vars
		, '.'
		, struct.var_types
		, []
		//, struct.varname_pool
		//, struct.if_else_tree
		, []
		//, struct.loop_pool
	);
	
	return struct;
}

var get_varname = (node) => {
	var key = node.varname;
	if(!key.length){
		if(node.classnames){
			key = node.classnames.substr(1).split('.').pop();
		} else {
			console.warn('Incorrect statement: variable without name and default class!');
		}
	}
	return key;
}

var get_dots = (loop_level) => {
	return new Array(loop_level + 2).join('.');
}
var get_level = (varname) => {
	var level = 0;
	for(var i in varname){
		if(varname[i] === '.'){
			++level;
		}
	}
	return level - 1;
}

var prefix = 'ololo@!@!#_';

var register_varname = (varname, varname_pool, if_else_deps, if_else_tree, loops, loop_pool) => {
	var original_varname = varname;
	if(varname_pool.vars[varname]){
		// already exists!
		//console.log('VAR', varname, 'already exists!');
		init_if_empty(varname_pool.var_aliases, varname, []);
		var new_name = prefix + varname + '_' + varname_pool.var_aliases[varname].length;
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
	if(loops.length){
		var last_loop = loop_pool[loops[loops.length - 1]];
		if(original_varname.indexOf(get_dots(last_loop.level)) !== 0){;
			var curr_loop = last_loop;
			var var_level = get_level(varname);
			while(true){
				if(curr_loop === 'root'){
					init_if_empty(varname_pool, 'loop_var_links', {}, original_varname, {}, varname, last_loop);
					break;
				} else {
					if(curr_loop.level == var_level){
						var vrkey = original_varname.indexOf('.') !== - 1 ? last(original_varname.split('.')) : original_varname;
						init_if_empty(curr_loop, 'subordinary_loop_vars', {}, vrkey, last_loop);
						break;
					}
					curr_loop = curr_loop.parent_loop;
				}
				
				if(curr_loop === 'root'){
					break;
				}
				if(!curr_loop){
					curr_loop = 'root';
				}
			}
		}
		init_if_empty(last_loop, 'vars', {});
		last_loop.vars[varname] = true;
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

var register_loop = function(varname, level, pool, parent_loop){
	var lp = {
		parent_loop,
		name: varname,
		level,
	}
	if(parent_loop){
		init_if_empty(parent_loop, 'nested_loops', []);
		parent_loop.nested_loops.push(lp);
	}
	pool[varname] = lp;
	return lp;
}

var fix_path = (path) => {
	return path.replace('./*[1]', '.');
}


Ozenfant.prototype.register_path = function(varname, path, pool, loop){
	if(loop){
		init_if_empty(loop, 'paths', {});
		pool = loop.paths;
	}
	var has_loops = false;
	if(path.indexOf('_{}_') !== -1){
		var pieces = path.split('_{}_');
		has_loops = true;
		path = pieces[pieces.length - 1];
	}
	if(path.indexOf('./*[1]') !== 0 && (!has_loops) && path.length){
		console.error('Template should have only one root node! Given', this.struct.semantics.length);
	} else {
		path = fix_path(path);
	}
	pool[varname] = path;
}

var special_html_setters = {
	'hasClass': (binding, val, [classname]) => {
		toggle_class(binding, classname, val);
	},
}

Ozenfant.prototype.get_vars = function(node, path, types, if_else_deps, loops, parent_has_loop){
	var node_pool = this.node_vars_paths;
	var text_pool = this.text_vars_paths;
	var path_pool = this.nodes_vars;
	var last_loop;
	if(loops.length){
		last_loop = this.loop_pool[loops[loops.length - 1]];
	}
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
				if(parent_has_loop){
					new_path = path + '/_{}_';
				} else {
					new_path = path + '/*[' + (Number(i) + 1 - nodes_lag) + ']';
				}
			}
			if(zild.type && (
					zild.type === 'NEW_IF'
					|| zild.type === 'NEW_ELSEIF'
					|| zild.type === 'NEW_ELSE')){
				if(zild.type === 'NEW_IF'){
					var varname = register_varname(get_varname(zild), this.varname_pool, if_else_deps, this.if_else_tree, loops, this.loop_pool);
					resigtered_vars[varname] = true;
					this.register_path(varname, new_path, node_pool, last_loop);
					types[varname] = get_partial_func(node);
					var my_if_else_deps = [...if_else_deps];
					my_if_else_deps.push(zild.expr)
					this.get_vars(zild, new_path, types, my_if_else_deps, loops);
					continue;
				}
				if(zild.type === 'NEW_ELSEIF' || zild.type === 'NEW_ELSE'){
					var varname = get_varname(zild);
					if(!resigtered_vars[varname]){
						register_varname(varname, this.varname_pool, if_else_deps, this.if_else_tree, loops, this.loop_pool);
					}
					types[varname] = get_partial_func(node);
					this.register_path(varname, new_path, node_pool, last_loop);
					var my_if_else_deps = [...if_else_deps];
					my_if_else_deps.push(zild.real_expr)
					this.get_vars(zild, new_path, types, my_if_else_deps, loops);
					continue;
				}
				this.get_vars(zild, new_path, types, if_else_deps, loops);
			} else {
				if(zild.varname !== undefined){
					var varname = register_varname(get_varname(zild), this.varname_pool, if_else_deps, this.if_else_tree, loops, this.loop_pool);
					this.register_path(varname, new_path, node_pool, last_loop);
				}
				if(zild.attrStyleVars){
					for(let [varname, attrname] of zild.attrStyleVars){
						varname = register_varname(varname, this.varname_pool, if_else_deps, this.if_else_tree, loops, this.loop_pool);
						this.register_path(varname, new_path, node_pool, last_loop);
						
						const pieces = attrname.split('|');
						const real_name = pieces[0];
						if(special_html_setters[real_name]){
							// its special setter
							types[varname] = {
								type: 'SETTER',
								name: real_name,
								params: pieces.slice(1)
							}
						} else {
							let as_type = is_attr(attrname) ? 'ATTR' : 'STYLE';
							types[varname] = {
								type: as_type,
								name: attrname,
							}
						}
						
					}
					this.get_vars(zild, new_path, types, [...if_else_deps], loops);
				} 
				if(zild.quoted_str){
					//console.log('str!', node.children[i].quoted_str);
					zild.quoted_str.replace(text_var_regexp, (_, key) => {
						var text_path = fix_path(path + '/text()[' + (Number(i) + 1 - text_lag) + ']');
						varname = register_varname(key, this.varname_pool, if_else_deps, this.if_else_tree, loops, this.loop_pool);
						if(!path_pool[text_path]){
							path_pool[text_path] = zild.quoted_str;
						}
						text_pool[varname] = text_path;
						//console.log('text key found', key, text_path);
					})
				} 
				var new_loops = [...loops];
				if(zild.loop){
					let loopname = register_varname(zild.loop, this.varname_pool, if_else_deps, this.if_else_tree, loops, this.loop_pool);
					var loop = register_loop(loopname, loops.length, this.loop_pool, last_loop);
					this.register_path(loopname, new_path, node_pool, last_loop);
					types[loopname] = {
						type: 'LOOP',
						func: get_partial_func(zild),
						loop,
					}
					new_loops.push(loopname);
				}
				this.get_vars(zild, new_path, types, [...if_else_deps], new_loops, !!zild.loop);
			}
		}
	}
}

var input_types = new Set(['text', 'submit', 'checkbox', 'radio', 'range']);

var toHTML = function(node, context, parent_tag){
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
	var varname;
	if(dot_counter){
		varname = a.substr(dot_counter);
		varname = varname.length ? '.' + varname : '';
		a = '__loopvar' + dot_counter + varname ;
	} else {
		a = a.length ? '.' + a : '';
		a = 'ctx' + a;
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
	if(node.loop){
		need_partial_func = true;
	}
	if(is_new_if(node)){
		switch(node.type){
			case 'NEW_IF':
				//console.log('IF STACK', if_stack);
				if_stack[node.level] = [toFuncVarname(node.varname), node.expr, []];
				res1.push(indent + "'); if(" + node.expr + ") { res.push('");
				childs_html = get_children_html(childs, parent_tag, if_stack, pp, loop_level);
				res1.push(childs_html);
				res1.push(`'); }
res.push('`);
			break;
			case 'NEW_ELSEIF':
				var [varname, expr, elifs] = if_stack[node.level];
				if_stack[node.level][2].push(node.expr);
				node.real_expr = node.expr + " && !(" + expr + ")";
				res1.push(indent + "'); if(" + node.expr + " && !(" + expr + ")) { res.push('");
				childs_html = get_children_html(childs, parent_tag, if_stack, pp, loop_level);
				res1.push(childs_html);
				res1.push(indent + `'); }
res.push('`);
			break;
			case 'NEW_ELSE':
				var [varname, expr, elifs] = if_stack[node.level];
				node.varname = varname;
				node.real_expr = "!(" + expr + "" + (elifs.length ? ' || ' + elifs.join(' || ') : '') + ")";
				res1.push(indent + "'); if(!(" + expr + "" + (elifs.length ? ' || ' + elifs.join(' || ') : '') + `)) { res.push('`);
				childs_html = get_children_html(childs, parent_tag, if_stack, pp, loop_level);
				res1.push(childs_html);
				res1.push(indent + `'); }
res.push('`);
			break;
		}
	} else if (node.tagname || node.classnames || !parent_tag){
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
		childs_html = get_children_html(childs, tag, if_stack, pp, loop_level);
		res1.push(childs_html);
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
				var key = toFuncVarname(get_varname(node));
				if(childs.length){
					console.error('Node should have either variable or child nodes, both given. Node: "' + node.tagname + node.classnames + '", variable: "' + key + '"');
				}
				res2.push(indent + getvar_raw(key));
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
			res2.push(indent + '</' + tag + '>');
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
			node.partial_func = create_func(childs_html, false, loop_level);
			if(pp){
				for(let nd of pp){
					nd.partial_func = node.partial_func;
				}
			}
		}
	}
	return res_final;
}

var trim_dots = (str) => {
	var c = 0;
	for(let i in str){
		if(str[i] === '.') {
			++c;
		} else {
			break;
		}
	}
	return str.substr(c);;
}

Ozenfant.prototype.toHTML = function(context){
	if(context){
		this.state = context;
	} else {
		context = {};
	}
	if(!this.struct.func){
		this.struct.func = create_func(toFunc({children: this.struct.semantics, root: true}));
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
			console.warn('No node found for var', varname, 'in path:', this.node_vars_paths[varname], 'in context', this.root, ', context', this.state);
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
	if(context){
		this.state = JSON.parse(JSON.stringify(context));
	}
	node.innerHTML = this.toHTML(this.state);
	this.setRoot(node);
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
Ozenfant.prototype.setFirstNode = function(node){
	this.root = node;
	return this;
}
Ozenfant.prototype.setRoot = function(node){
	this.root = node.children[0];
	return this;
}
Ozenfant.prototype._setVarVal = function(key, val, binding){
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
	binding.textContent = val;
}
Ozenfant.prototype._setValByPath = function(path, val, root_node){
	document.evaluate(path, root_node, null, XPathResult.ANY_TYPE, null).iterateNext().innerHTML = val;
}
Ozenfant.prototype.updateLoopVals = function(loopname, val, old_val, binding, context){
	var loop = this.loop_pool[loopname];
	var prefix = new Array(loop.level + 2).join('.');
	for(var k in val){
		if(val[k] === old_val[k]){
			//console.log('skip', k);
			continue;
		}
		var varname = prefix + k;
		if(this.varname_pool.var_aliases[varname]){
			for(let vn of this.varname_pool.var_aliases[varname]){
				if(loop.paths[vn]){
					this.set(vn, val[k], loop, binding, old_val[k], false, context);
				}
			}
		}
		if(loop.paths[varname]){
			this.set(varname, val[k], loop, binding, old_val[k], false, context);
		}
	}
}

Ozenfant.prototype.removeLoopItem = function(binding, i){
	if(binding.children[i]){
		binding.children[i].remove();
	} else {
		console.warn('Cannot remove unexisting', i);
	}
}
Ozenfant.prototype.addLoopItems = function(loop, from, to, val, old_val, binding, context){
	var res = [];
	var func = this.var_types[loop].func;
	for(var i = from; i<= to; ++i){
		old_val[i] = val[i];
		var ht = func.apply(null, context.concat(val[i]));
		res.push(ht);
	}
	// !!! should be rewritten!
	binding.insertAdjacentHTML("beforeend", res.join(''));
}

Ozenfant.prototype.setLoop = function(loopname, val, old_val, binding, parent_context){
	var skip_removing = false;
	for(var i in val){
		if(old_val[i]){
			this.updateLoopVals(loopname, val[i], old_val[i], binding.children[i]);
		} else {
			skip_removing = true;
			this.addLoopItems(loopname, i, val.length - 1, val, old_val, binding, parent_context);
			break;
		}
	}
	++i;
	if(old_val[i] && !skip_removing){
		var init_i = i;
		var del_count = 0;
		for(let j = old_val.length - 1;j >= i;j--){
			++del_count;
			this.removeLoopItem(binding, j);
		}
		old_val.splice(init_i, del_count);
	}
}

Ozenfant.prototype.eachLoopBinding = function(loop, cb){
	var parent = loop.parent_loop;
	var binding;
	if(parent){
		this.eachLoopBinding(parent, (bnd, val_arr) => {
			var pth = parent.paths[loop.name];
			binding = Ozenfant.xpOne(pth, bnd);
			if(!binding){
				console.error('Cannot find bindings', bnd, pth);
			}
			var llevel = get_level(loop.name);
			var scope = val_arr[llevel][trim_dots(loop.name)];
			for(let c in binding.children){
				if(Number(c) != c) continue;
				let child = binding.children[c];
				if(!val_arr) debugger;
				cb(child, val_arr.concat(scope[c]), c);
			}
		})
		return;
	} else {
		// its root
		var val = this.state[loop.name];
		binding = this.bindings[loop.name];
		for(let c in binding.children){
			if(Number(c) != c) continue;
			let child = binding.children[c];
			cb(child, [val[c]], c);
		}
	}
} 

Ozenfant.prototype.rec_set = function(el, parent_loop, path, val, context, old_val, level = 0){
	var pth = path.split('/');
	var first = pth[0].match(/([^\[]*)\[([^\]]*)\]/);
	if(!first){
		var keyname = new Array(level + 1).join('.') + pth[0];
		var paths_hash = parent_loop.paths || parent_loop.node_vars_paths;
		if(paths_hash[keyname]){
			var binding = Ozenfant.xpOne(paths_hash[keyname], el);
			old_val = old_val[trim_dots(keyname)];
			if(this.loop_pool[keyname]){
				this.setLoop(keyname, val, old_val, binding, context);
			} else {
				this.__set(keyname, val, old_val, binding);
			}
		} else {
			var key = new Array(parent_loop.level + 2).join('.') + path;
			traverse_tree(parent_loop, (loop) => {
				if(loop.paths[key]){
					this.eachLoopBinding(loop, (bnd) => {
						var bind = Ozenfant.xpOne(loop.paths[key], bnd);
						this.__set(key, val, null, bind, loop);
					})
				}
			}, 'nested_loops');
		}
		return;
	}
	var loopname = new Array(level + 1).join('.') + first[1];
	var index = first[2];
	old_val = old_val[trim_dots(loopname)][index];
	var loop = this.loop_pool[loopname];
	var path_pool = parent_loop === this ? this.node_vars_paths : parent_loop.paths;
	var loop_binding = Ozenfant.xpOne(path_pool[loopname], el);
	var bnd = loop_binding.children[index];
	var rest = pth.slice(1);
	if(rest.length){
		var new_context = last(context)[loopname][index];
		this.rec_set(bnd, loop, rest.join('/'), val, context.concat(new_context), old_val, ++level);
	} else {
		var new_context = last(context)[first[1]][index];
		if(new_context){
			// already exists
			this.updateLoopVals(loopname, val, new_context, bnd, context);
		} else {
			// @todO!
			//this.addLoopItems(loopname, index, index, val, binding);
		}
		//console.log('FINAL', bnd, val, new_context);
	}
}

Ozenfant.prototype.__set = function(key, val, old_val, binding, loop, loop_context) {
	if(this.nodes_vars[this.text_vars_paths[key]]){
		var template = this.nodes_vars[this.text_vars_paths[key]];
		//console.log('template!', template);
		var new_str = template.replace(text_var_regexp, (_, key) => {
			return this.state[key];
		});
		this._setVarVal(key, new_str, binding);
		binding.innerHTML = new_str;
	} else {
		if(this.var_types[key]){
			switch(this.var_types[key].type){
				case 'ATTR':
					binding.setAttribute(this.var_types[key].name, val);
				break;
				case 'STYLE':
					binding.style[this.var_types[key].name] = val;
				break;
				case 'SETTER':
					special_html_setters[this.var_types[key].name](binding, val, this.var_types[key].params);
				break;
				case 'LOOP':
					const ct = loop_context || [this.state];
					this.setLoop(key, val, old_val, binding, ct);
				break;
				default:
					var func;
					if(this.var_types[key] === 'USE_ROOT_FUNC'){
						func = this.struct.func;
					}
					if(this.var_types[key] instanceof Function){
						func = this.var_types[key];
					}
					var ctx = [this.state];
					if(loop){
						ctx = [this.state, ...loop_context];
					}
					var html = func.apply(null, ctx);
					binding.innerHTML = html;
					this.updateBindings();
				break;
			}
		} else {
			this._setVarVal(key, val, binding);
		}
	}
}

Ozenfant.prototype.set = function(key, val, loop, loop_binding, old_data, force, loop_context){
	var binding;
	if(key.indexOf('/') !== -1){
		// @todo
		if(key[0] === '/'){
			key = key.substr(1);
		}
		this.rec_set(this.root, this, key, val, [this.state], this.state);
		return;
	}
	if(this.state[key] === val && !force){
		return; 
	} 
	if(val instanceof Object){
		// we need to make deep copy
		try {
			val = JSON.parse(JSON.stringify(val));
		} catch(e) {
			//let it be ;)
		}
	}
	var old_val = loop ? old_data : this.state[key];
	if(!force && key[0] !== '.'){
		this.state[key] = val;
	}
	if(this.varname_pool.loop_var_links && this.varname_pool.loop_var_links[key] && !loop){
		for(var cn in this.varname_pool.loop_var_links[key]){
			var l_loop = this.varname_pool.loop_var_links[key][cn];
			this.eachLoopBinding(l_loop, (node, loop_ctx, i) => {
				this.set(cn, val, l_loop, node, old_val, true, loop_ctx);
			})
		}
	}
	if(this.varname_pool.var_aliases[key]){
		for(let k of this.varname_pool.var_aliases[key]){
			this.set(k, val, loop, loop_binding, old_data, true);
		}
	}
	if(loop) {
		binding = Ozenfant.xpOne(loop.paths[key], loop_binding);
	} else {
		if(!this.bindings[key]){
			return;
		}
		binding = this.bindings[key];
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
	this.__set(key, val, old_val, binding, loop, loop_context);
}
Ozenfant.xpOne = (path, node = document) => {
	if(node !== document && path[0] === '/'){
		path = path.substr(1);
	}
	if(path === '') {
		return node;
	}
	return document.evaluate(path, node, null, XPathResult.ANY_TYPE, null).iterateNext(); 
}

module.exports = Ozenfant;

