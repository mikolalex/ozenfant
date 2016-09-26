/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	var ozenfant_config = __webpack_require__(1);
	var parser = __webpack_require__(2).get_parser(ozenfant_config);

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

	var Ozenfant = function(str){
		this.struct = parser(str);
		this.node_vars_paths = {};
		this.text_vars_paths = {};
		this.nodes_vars = {};
		this.var_types = {};
		get_vars({children: this.struct.semantics}, this.node_vars_paths, this.text_vars_paths, this.nodes_vars, '.', this.var_types, []);
		this.getIfElseVarsIndex();
	};
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

	var add_to_if_else_pool = (pools, varname, path) => {
		for(var pool of pools){
			pool[varname] = path;
		}
	}

	var get_vars = (node, node_pool, text_pool, path_pool, path, types, if_else_pools) => {
		if(node.children){
			var nodes_lag = 0;
			var text_lag = 0;
			for(var i in node.children){
				var zild = node.children[i];
				if(!zild.tagname && !zild.classnames){
					//console.log('text node!', node.children[i]);
						++nodes_lag;
				} else {
						++text_lag;
				}
				var new_path = path + '/*[' + (Number(i) + 1 - nodes_lag) + ']';
				if(zild.type){
					if(zild.type === 'ELSE'){
						return;
					}
					if(zild.type === 'IF'){
						var if_pool = {};
						var else_pool = {};

						node_pool[get_varname(zild)] = new_path;
						add_to_if_else_pool(if_else_pools, get_varname(zild), new_path);
						types[get_varname(zild)] = {
							type: 'IF',
							struct: zild,
							if_pool,
							else_pool,
						};
						var if_pools = if_else_pools.slice();
						if_pools.push(if_pool);
						var else_pools = if_else_pools.slice();
						else_pools.push(else_pool);
						get_vars(zild, node_pool, text_pool, path_pool, new_path, types, if_pools);
						get_vars(zild.else_children, node_pool, text_pool, path_pool, new_path, types, else_pools);
					} else {
						get_vars(zild, node_pool, text_pool, path_pool, new_path, types, if_else_pools);
					}
				} else if(zild.varname !== undefined){
					add_to_if_else_pool(if_else_pools, get_varname(zild), new_path);
					node_pool[get_varname(zild)] = new_path;
					//console.log('Found var!', get_varname(node.children[i]), new_path);
				} else if(zild.quoted_str){
					//console.log('str!', node.children[i].quoted_str);
					zild.quoted_str.replace(/\$([a-zA-Z0-9]*)/g, (_, key) => {
						var text_path = path + '/text()[' + (Number(i) + 1 - text_lag) + ']';
						if(!path_pool[text_path]){
							path_pool[text_path] = zild.quoted_str;
						}
						text_pool[key] = text_path;
						//console.log('text key found', key, text_path);
					})
				} else {
					get_vars(zild, node_pool, text_pool, path_pool, new_path, types, if_else_pools);
				}
			}
		}
	}

	var html_attrs = new Set(['href', 'src', 'style', 'target', 'id', 'class', 'rel', 'type'])
	var input_types = new Set(['text', 'submit', 'checkbox', 'radio']);

	var toHTML = function(node, context, parent_tag){
		var indent = `
	` + new Array(node.level).join('	');
		var res1 = [], res2 = [], after = '';
		if(node.type === 'ELSE'){
			return '';
		}
		var childs = node.children;
		if(node.type === 'IF'){
			if(!context[node.varname]){
				// "ELSE" part
				childs = node.else_children.children;
			}
		}
		if(node.tagname || node.classnames || !parent_tag){
			// it's a node
			var tag;
			if(node.tagname){
				if(input_types.has(node.tagname)) {
					node.assignments = node.assignments || [];
					node.assignments.push('type: ' + node.tagname);
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
						var assign = ass.split(':');
						var key = assign[0].trim();
						var val = assign[1].trim();
						if(html_attrs.has(key) || key.match(/^data\-/)){
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
				return indent + node.quoted_str.replace(/\$([a-zA-Z0-9]*)/g, function(_, key){
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

	Ozenfant.prototype.toHTML = function(context = {}){
		var res = toHTML({children: this.struct.semantics}, context = context);
		return res;
	}

	Ozenfant.prototype.searchByPath = function(path){
		return Ozenfant.xpOne(path, this.root);
	}

	Ozenfant.prototype.getIfElseVarsIndex = function(){
		this.if_else_vars = {};
		for(var one in this.var_types){
			for(var varname in this.var_types[one].if_pool){
				var path = this.var_types[one].if_pool[varname];
				init_if_empty(this.if_else_vars, varname, {}, one, true);
			}
			for(var varname in this.var_types[one].else_pool){
				var path = this.var_types[one].if_pool[varname];
				init_if_empty(this.if_else_vars, varname, {}, one, false);
			}
		}
	}

	Ozenfant.prototype.updateBindings = function(){
		this.bindings = {};
		for(let varname in this.node_vars_paths){
			this.bindings[varname] = this.searchByPath(this.node_vars_paths[varname]);
			if(!this.bindings[varname]){
				console.warn('No node found for path:', this.node_vars_paths[varname], 'in context', this.root);
			}
		}
		for(let varname in this.text_vars_paths){
			this.bindings[varname] = this.searchByPath(this.text_vars_paths[varname]);
			if(!this.bindings[varname]){
				console.warn('No node found for path:', this.text_vars_paths[varname], 'in context', this.root);
			}
		}
	}
	Ozenfant.prototype.render = function(node, context){
		this.root = node;
		this.state = context;
		node.innerHTML = this.toHTML(this.state);
		this.updateBindings();
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
		this.bindings[key].textContent = val;
	}
	Ozenfant.prototype.set = function(key, val){
		this.state[key] = val;
		if(!this.bindings[key]){
			//console.warn('Unknown key for binding:', key);
			return;
		}
		if(!this.root) return;
		//console.log('path', this.text_vars_paths[key], 'vars', this.nodes_vars);
		if(this.nodes_vars[this.text_vars_paths[key]]){
			var template = this.nodes_vars[this.text_vars_paths[key]]
			var new_str = template.replace(/\$([a-zA-Z0-9]*)/g, (_, key) => {
				return this.state[key];
			});
			this._setVarVal(key, new_str);
			this.bindings[key].textContent = new_str;
		} else {
			if(this.var_types[key] && this.var_types[key].type === 'IF'){
				var struct = val 
				? this.var_types[key].struct.children 
				: this.var_types[key].struct.else_children.children;
				var html = toHTML({children: struct}, this.state);
				this.bindings[key].innerHTML = html;
				// @todo should be optimized! update bindings only for dependent vars!
				this.updateBindings();
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



/***/ },
/* 1 */
/***/ function(module, exports) {

	var fields = ['classnames', 'tagname', 'str', 'quoted_str'];
	module.exports = {
		empty_chars: [' '],
		syntax: {
			root_token: {
				children: [
					'>',
					{
						type: 'item',
						multiple: true,
						optional: true,
					},
				]
			},
			item: {
				children: [
					'>',
					{
						type: 'indent',
						optional: true,
					},
					[
						'|',
						{
							type: 'ternary_else',
						},
						[
							'>',
							{
								type: 'tagname',
								optional: true,
							},
							{
								type: 'classnames',
								optional: true,
							},
							[
								'|', 
								{
									type: 'quoted_str',
									optional: true,
								}, {
									type: 'variable',
									optional: true,
								},
								'optional'
							],
							{
								type: 'bracket',
								optional: true,
							},
							{
								type: 'str',
								optional: true,
							},
						],
					],
					{
						type: 'lineend',
					}
				]
			},
			comma: {
				regex: /^\,\s?$/,
				free_chars: true,
			},
			bracket: {
				start: '(',
				children: [
					'>',
					{
						type: 'assign',
						optional: true,
					},
					[
						'>',
						{
							type: 'comma',
						},
						{
							type: 'assign'
						},
						'optional'
					]

				],
				end: ')',
			},
			assign: {
				free_chars: true,
				regex: /^[^\)^\,]*$/
			},
			quoted_str: {
				start: '"',
				end: '"',
				free_chars: true,
			},
			variable: {
				children: [
					'>',
					{
						type: 'varname',
					},
					{
						type: 'ternary_if',
						optional: true,
					}
				]
			},
			ternary_if: {
				regex: /^\?$/,
				free_chars: true,
			},
			ternary_else: {
				regex: /^\:$/,
				free_chars: true,
			},
			varname: {
				regex: /^\$[a-zA-Z0-9\-\_]*$/,
				free_chars: true,
			},
			indent: {
				regex: /^\t+$/,
				free_chars: true,
			},
			classnames: {
				regex: /^\.[\\.a-zA-Z0-9\-\_]*$/,
				free_chars: true,
			},
			tagname: {
				regex: /^[a-zA-Z0-9]+$/,
				free_chars: true,
			},
			str: {
				regex: /^[^\n]+$/,
				free_chars: true,
			},
			lineend: {
				regex: /\n$/,
				free_chars: true,
			},
		},
		semantics: {
			root_token: {
				func: (struct, parser) => {

					var res = {children: []};
					var last_of_level = {
						"-1": res,
					}
					var che_results = parser(struct.children);
					//console.log('Results', che_results);
					var max_level = 0;
					var last_if;
					for(let i in che_results){
						let child = che_results[i];
						if(!child.tagname && !child.classnames && !child.quoted_str && !child.variable && !child.type) {
							continue;
						}
						if(child.type === 'IF'){
							last_if = child;
						}
						if(child.type === 'ELSE'){
							last_if.else_children = child;
						}
						var lvl = child.level || 0;
						if(lvl > max_level){
							max_level = lvl;
						}
						var put_to = lvl - 1;
						child.children = [];
						if(!last_of_level[put_to]){
							for(;put_to--;put_to > -2){
								if(last_of_level[put_to]) break;
							}
							if(!last_of_level[put_to]){
								continue;
							}
						}
						//console.log('putting', child, put_to, 'to', last_of_level[put_to]);
						last_of_level[put_to].children.push(child);
						last_of_level[lvl] = child;
						if(lvl + 1 < max_level){
							//console.log('lvl', lvl+1, max_level);
							var j = lvl + 1;
							for(var j = lvl + 1;j <= max_level;j++){
								if(!last_of_level[j]) break;
								//console.log('delete', last_of_level[j]);
								delete last_of_level[j];
							}
						}
					}
					return res.children;
				}
			},
			item: {
				func: (struct, parser) => {
					var res = {};
					for(let child of struct.children){
						switch(child.type){
							case 'variable':
								res.varname = child.children[0].chars.slice(1);
								if(child.children[1]){
									res.type = "IF";
								}
								return res;
							break;
							case 'ternary_else':
								res.type = "ELSE";
							break;
							case 'indent':
								res.level = child.chars.length;
								//console.log('INDEX', res.level);
							break;
							case 'bracket':
								res.assignments = [];
								for(let child1 of child.children){
									if(child1.type === 'assign'){
										res.assignments.push(child1.chars);
									}
								}
								//console.log('INDEX', res.level);
							break;
						}
						if(fields.indexOf(child.type) !== -1){
							res[child.type] = child.chars;
						}
					}
					return res;
				}
			},
			indent: {
				type: 'chars',
			}
		}
	}


/***/ },
/* 2 */
/***/ function(module, exports) {

	/* 
	 * To change this license header, choose License Headers in Project Properties.
	 * To change this template file, choose Tools | Templates
	 * and open the template in the editor.
	 */

		var get_token = (type) => {
			return {
				type: type,
				children: [],
			}
		}
		var match_start = function(){

		}
		var empty_chars_default = [' ', '	', `
	`];
		var head = (a) => {
			return a[0];
		}
		var tail = (a) => {
			return a.slice(1);
		}

		var parse_semantics = function(config, struct){
			if(struct instanceof Array){
				if(struct.length === 1){
					struct = struct[0];
				} else {
					var r = [];
					for(var i in struct){
						r.push(parse_semantics(config, struct[i]));
					}
					return r;
				}
			}
			if(!struct){
				console.warn('oops', config, struct);
				return;
			}
			var type = struct.type;
			var children = struct.children;
			var sem = config[type];
			if(!sem){
				console.error('No token semantic description', type, struct);
				return;
			}
			if(sem.type){
				switch(sem.type){
					case 'door':
						var to_parse = sem.ret ? children[sem.ret - 1] : children;
						return parse_semantics(config, to_parse);
					break;
					case 'chars':
						return {chars: struct.chars}
					break;
				}
			}
			if(sem.func){
				return sem.func(struct, parse_semantics.bind(null, config));
			}
		};

		var flatten = function(struct, arr){
			var get_children = function(struct, arr){
				if(struct.children){
					for(var i in struct.children){
						if(struct.children[i].type){
							var child = {
								type: struct.children[i].type,
								children: [],
							}
							if(struct.children[i].chars){
								child.chars = struct.children[i].chars;
							}
							arr.push(child);
							get_children(struct.children[i], child.children);
						} else {
							get_children(struct.children[i], arr);
						}
					}
				}
			}
			var res = [];
			get_children({children: [struct]}, res);
			return res[0];
		}

		var parse = function(config, str, debug){
			var is_empty_char = (char) => {
				var empty_chars = config.empty_chars || empty_chars_default;
				return empty_chars.indexOf(char) !== -1;
			}
			var parse_rec = function parse_rec(tt, str, pos){
				var original_pos = pos;
				var showpos = function(){
					return str.substr(0, pos) + '@@@' + str.substr(pos);
				}
				//console.log('Parsing', '___' + tt + '___', 'token from', pos, showpos());
				var children;
				var res = {
					children: [],
				};
				if(typeof tt === 'string'){
					res.type = tt;
					if(!config.syntax[tt]){
						console.error('Token not found:', tt);
					}
					var tk = config.syntax[tt];
					//console.log('Token props:', tk);
					if(tk.start !== undefined){
						var started = false;
						var start_pos = pos;
						while(++pos){
							var char = str[pos - 1];
							if(is_empty_char(char)){
								continue;
							}
							if(char !== tk.start){
								//console.log('parsing', tt, 'failed:', pos, 
								//str[pos], 'instead of', tk.start);
								return [false, start_pos];
							} else {
								break;
							}
						}
					}
					if(tk.children){
						children = tk.children;
					} else {
						if(tk.free_chars){
							//console.log('Parsing free chars');
							var start_pos = pos;
							if(tk.end || tk.regex){
								var started = false;
								var lag = 0;
								while(++pos){
									var char = str[pos - 1];
									if(char === undefined){
										// we reached the end!
										if(pos - start_pos > 1){
											//console.log('we reached the end!');
											res.chars = str.substr(start_pos, pos - start_pos - 1);
											return [res, pos - 1];
										} else {
											return false;
										}
										//return [res, pos + 1];
									}
									//console.log('parsing free chars', '"' + char + '"', 'as', tt);
									if(is_empty_char(char) && !started){
										++lag;
										continue;
									}
									if(tk.end && char === tk.end){
										res.chars = str.substr(start_pos, pos - start_pos - 1 + lag);
										return [res, pos];
									} else {
										if(tk.regex){
											var string_to_compare = str.substr(start_pos + lag, pos - start_pos - lag);
											var a1 = !!char.match(tk.regex);
											var a2 = !!string_to_compare.match(tk.regex);
											//console.log('matching regex', tk.regex, 'against', string_to_compare, a1, started);
											//if(a1 !== a2){
											//console.log('Comparing', start_pos, a1, a2, tt, '"' + char + '"', 'vs.', '"' + string_to_compare + '".match(' + tk.regex + ')');
											//}
											if(!char || !(string_to_compare.match(tk.regex))){
												if(started){
													res.chars = str.substr(start_pos + lag, pos - start_pos - 1 - lag);
													//console.log('______________ success', res.chars);
													return [res, pos - 1];
												} else {
													//console.log('DED END!', char, tt);
													return [false, pos - 1 - lag];
												}
											}
										}
									}
									started = true;
								}
							} else {
								console.warn('Could not parse free chars without end!');
								return [false, pos];
							}
						} else if(tk.str){
							// just exact string
							var test_str = str.substr(pos, tk.str.length);
							if(test_str === tk.str){
								return [res, pos + tk.str.length];
							} else {
								return [false, pos];
							}
						} else {
							console.warn('No chars and no tokens - what to do?', tk);
						}
					}
				} else {
					children = tt;
				}
				if(!children) return res;
				var children_type = head(children);
				var rest_children = tail(children);
				//console.log('chtype', children_type, rest_children);
				switch(children_type){
					case '>':
						//console.log('parsing > children', tt);
						var p = pos;
						for(var b of rest_children){
							if(typeof b === 'string') continue;
							var r;
							var struct_to_parse = b instanceof Array ? b : b.type;
							var optional = b.optional;
							var multiple = b.multiple;
							if(struct_to_parse instanceof Array && typeof struct_to_parse[struct_to_parse.length - 1] === 'string'){
								optional = true;
								multiple = true;
							}
							while(true){
								//console.log('parsing multiple', struct_to_parse, 'as', tt, b);
								var rz = parse_rec(struct_to_parse, str, p);
								r = rz[0];
								p = rz[1];
								if(!r){
									if(optional){
											break;
									}
									return [false, p];
								}	
								pos = p;
								res.children.push(r);
								if(multiple){
									if(str[p] === undefined){
										break;
									}
								} else {
									break;
								}
							}
						}
					break;
					case '|':
						//console.log('parsing | children', children);
						for(var b of rest_children){
							if(typeof b === 'string') continue;
							var r;
							var struct_to_parse = b instanceof Array ? b : b.type;
							var rz = parse_rec(struct_to_parse, str, pos);
							r = rz[0];
							p = rz[1];
							if(!r){
								continue;
							} else {
								res.children.push(r);
								pos = p;
								break;
							}
							return [false, pos];
						}
						if(!res.children.length){
							//console.log('Nothing found', tt);
							return [false, pos];
						}
					break;
					default:
						console.error('Unknown children type:', children_type);
					break;
				}
				if(tk && tk.end){
					var pp = pos;
					while(++pp){
						var char = str[pp - 1];
						if(is_empty_char(char)){
							continue;
						}
						if(char === tk.end){
							pos = pp;
						}
						break;
					}
				}
				return [res, pos];
			}
			var struct = parse_rec('root_token', str, 0);
			struct = flatten(struct[0]);
			// sematic parsing
			var semantics = parse_semantics(config.semantics, struct);
			return {syntax: struct, semantics};
		}
		module.exports = {
			get_parser: (config) => {
				return parse.bind(null, config);
			},
			dump: function(struct){
				var rec = function(struct, level){
					if(!struct) return;
					var res = [];
					if(struct.type){
						res.push('Type: ' + struct.type);
					}
					if(struct.chars){
						res.push('Str: ' + struct.chars);
					}
					if(struct.children){
						var r = [];
						for(var i in struct.children){
							r.push(rec(struct.children[i], level+1));
						}
						res.push('<div>' + r.join('	') + '</div>');
					}
					return '<div>' + res.join('<br>') + '</div>';
				}
				return rec(struct, 0);
			}
		}


/***/ }
/******/ ]);