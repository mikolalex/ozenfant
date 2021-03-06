var $ = require('jquery');
var assert = require('assert');
var che_parser = require("ooo_oo_o");
var Ozenfant = require('../ozenfant');


var id = a => a;
var always = (a) => {
	return () => a;
}
var example = `
body
	.wrapper
		menu
		.content
			.login-block
				"Hello, Mr."
				$username
				". Welcome
				to our 
				site!
				"
				
			ul.comments
				.comment
					.$date
					.$user
					.comment-text
						$text
				.comment
					.$date
					.$user
					.comment-text
						$text
				
			form.add-comment(method: post, background-color: $color, $font-size)
				.
					text(name: username)
				.
					textarea(name: )
				

 `;
var exp_struct = {
	"tag": "body",
	"children": [{
		"tag": "menu",
		"children": [{
			"tag": "li",
			"children": [{
				"tag": "a",
				"children": []
			}]
		}, {
			"tag": "li",
			"children": [{
				"tag": "a",
				"children": []
			}]
		}, {
			"tag": "li",
			"children": [{
				"tag": "a",
				"children": []
			}]
		}, {
			"tag": "li",
			"children": [{
				"tag": "a",
				"children": []
			}]
		}]
	}, {
		"tag": "section",
		"children": [{
			"tag": "header",
			"children": [{
				"children": [{
					"children": []
				}, {
					"children": []
				}]
			}]
		}]
	}, {
		"tag": "footer",
		"children": [{
			"children": []
		}]
	}]
}

//*

describe('Amadee Ozenfant', function () {
	var do_in_tree = (node, cb, child_key = 'children') => {
		if(!node) return;
		var res = cb(node);
		//console.log('Node', node, 'children', node[child_key], child_key);
		if(node[child_key] && node[child_key] instanceof Array){
			res.children = [];
			for(let child of node[child_key]){
				if(!child) continue;
				res.children.push(do_in_tree(child, cb, child_key));
			}
		}
		return res;
	}
	var key = (k) => {
		var fnc = (a) => { return a[k] };
		return fnc;
	}
	
	it('Testing variables', function(){
		var context = {
			login: 'Mikolalex',
			email: 'laaazyyy@gmail.com',
			date: '2011-01-01',
			year: 2016
		};
		var tmpl = `
			.
				.user
					.login$
					.e-mail$email
					.
						"Registered from"
						.$date
						" until now"
					.
						"Dummy!"
				footer
					"Some info. Copyright (c) {{year}}"
		`;
		var tmpl = new Ozenfant(tmpl);
		tmpl.render($(".test-variables").get(0), context);
		var html = tmpl.toHTML(context);
		//console.log('Semantics', tmpl.struct.semantics[0]);
		//console.log('HTML', html);
		//console.log('bindings', tmpl.bindings);
		
		tmpl.set('login', 'Ed1do');
		tmpl.set('year', '2011');
		console.log('tmpl', tmpl);
		
		assert.equal($(".test-variables .login").html(), 'Ed1do');
		assert.equal($.trim($(".test-variables footer").html()), 'Some info. Copyright (c) 2011');
		
	})
	it('Testing if/else expression', function(){
		var tmpl = `
				.
					? $logged_in
						"Hello, mr."
						span.username$
						"!"
					:
						.
							"Please, log in!"
						.no_luck$
		`;
		var ctx = {logged_in: true, username: 'Mikolalex', no_luck: 'Looser!'};
		var tmpl = new Ozenfant(tmpl);
		tmpl.render($(".test-if").get(0), ctx);
		//console.log('tmpl', tmpl.if_else_vars);
		
		
		tmpl.set('logged_in', false);
		tmpl.set('username', 'Antin');
		assert.equal($(".test-if .username").length, 0);
		assert.equal($(".test-if .no_luck").length, 1);
		tmpl.set('no_luck', 'Please log in!2');
		assert.equal($(".test-if .no_luck").html(), 'Please log in!2');
		tmpl.set('logged_in', true);
		assert.equal($(".test-if .username").length, 1);
		assert.equal($(".test-if .no_luck").length, 0);
		assert.equal($(".test-if .username").html().trim(), 'Antin');
		tmpl.set('logged_in', false);
		tmpl.set('no_luck', 'Looser!');
		assert.equal($(".test-if .no_luck").html(), 'Looser!');
		
	})
	
	it('Testing variables in styles and attrs', function(){
		var tmpl = `
	.				    
		.
			a(href: $link)
				"Go"
		.foo$(data-name: $bar)
		footer(width: $, background-color: green, height: 100px, padding: 10px)
			.somevar$
			"Thats all"
		
		`;
		tmpl = new Ozenfant(tmpl);
		tmpl.render($(".test-attr").get(0), {
			link: 'www.home.cern',
			width: '200px',
			somevar: 42,
			foo: 'llama',
			bar: 'baz',
		});
		tmpl.set('link', 'www.mikolalex.net');
		tmpl.set('width', '300px');
		tmpl.set('somevar', '37');
		assert.equal($(".test-attr .foo").attr('data-name'), 'baz');
		assert.equal($(".test-attr a").attr('href'), 'www.mikolalex.net');
		assert.equal($(".test-attr footer").css('width'), '300px');
		assert.equal($(".test-attr .somevar").html(), '37');
		assert.equal($(".test-attr .foo").html().trim(), 'llama');
	})
	
	it('testing nested if/else', () => {
		var tmpl = `
			.
				? $isObj
						.
								"OBJ"
						.
							? $isOpened
									a.close
										"close"
							:
									a.open
										"Open"
				:
						.
								"Scalar"
						.val$
		`;
		tmpl = new Ozenfant(tmpl, {
			isObj: true
		});
		tmpl.render($(".test-nested-if").get(0), {
			isObj: true
		});
		
		//console.log('tmpl', tmpl);return;
		var has = (str, substr) => {
			return str.indexOf(substr) !== -1;
		}
		assert.equal(true, has($(".test-nested-if").html(), 'class="open"'));
		
		tmpl.set('isObj', false);
		assert.equal(true, has($(".test-nested-if").html(), 'Scalar'));
		
		tmpl.set('isObj', true);
		assert.equal(true, has($(".test-nested-if").html(), 'class="open"'));
		
		tmpl.set('isOpened', true);
		assert.equal(true, has($(".test-nested-if").html(), 'class="close"'));
	})
	it('testing nested loops', (done) => { // */
		var tmpl = Ozenfant.prepare(`
		.{$companies}
			.
				h1.$_title
				.
					? $display_people
						ul.people{$_people}
							li
								.name$__name
								.surname$__surname
								.company$_company
								.relatives
									? !$display_list
										.company$_title
										select{$__relatives}
											option.$___name(value: $___type, data-name: $__name)
									:
										ul{$__relatives}
											li.$___name(data-value: $___type, data-name: $__name)
					:
						a.display-people
							"Display people"
								
		
		`);
		tmpl = new Ozenfant(tmpl);
		var root = $(".test-nested-loop");
		var rnode = root.get(0);
		var get_html = $(".test-nested-loop").html.bind($(".test-nested-loop"));
		var people = [
			{
				name: 'Michael',
				surname: 'Petrenko',
				relatives: [
					{
						type: 'sister',
						name: 'Katherine Kovalchuk'
					},
					{
						type: 'father',
						name: 'Opanas Petrenko'
					},
					{
						type: 'mother',
						name: 'Hrystya Petrenko'
					},
				]
			},
			{
				name: 'John',
				surname: 'Kovalchuk',
				relatives: [
					{
						type: 'son',
						name: 'Peter Kovalchuk'
					},
					{
						type: 'father',
						name: 'Petro Kovalchuk'
					},
				]
			},
			{
				name: 'Katherine',
				surname: 'Petrenko',
				relatives: [
					{
						type: 'husband',
						name: 'John Kovalchuk'
					},
					{
						type: 'father',
						name: 'Opanas Petrenko'
					},
					{
						type: 'mother',
						name: 'Hrystya Petrenko'
					},
				]
			},
		];
		tmpl.render(rnode, {
			companies: [{
				title: 'People\'s list',
				company: 'RSTSh studio',
				people,
			}],
			display_people: true,
		});
		//console.log('Tmpl', tmpl);
		assert.equal(root.find('li').length, 3);
		var ntd = 'Netudykhata';
		people[2].surname = ntd;
		tmpl.set('companies[0]/people[2]', people[2]);
		
		assert.equal(root.find('li:nth-child(3) .surname').html().trim(), ntd);
		
		people.pop();
		tmpl.set('companies[0]/people', people);
		assert.equal(root.find('li').length, 2);
		
		people.push({
			name: 'Katherine',
			surname: 'Petrenko',
			relatives: [
				{
					type: 'husband',
					name: 'John Kovalchuk'
				},
				{
					type: 'father',
					name: 'Opanas Petrenko'
				},
				{
					type: 'mother',
					name: 'Hrystya Petrenko'
				},
			]
		});
		people.push({
			name: 'Joanne',
			surname: 'Petrenko',
			relatives: [
				{
					type: 'father',
					name: 'Opanas Petrenko'
				},
				{
					type: 'mother',
					name: 'Hrystya Petrenko'
				},
			]
		});
		tmpl.set('companies[0]/people', people);
		assert.equal($(".people > *").length, 4);
		
		const comp2 = 'Brainstorm-IT';
		tmpl.set('companies[0]/company', comp2);
		assert.equal($(".people > *:first-child .company").html(), comp2);
		
		const comp3 = 'RSTSh';
		tmpl.set('companies[0]/company', comp3);
		assert.equal($(".people .company").html(), comp3);
		setTimeout(() => {
			tmpl.set('display_list', true);
			assert.equal($(".people > *:first-child ul > li").length, 3);
			done();
		}, 5);
		
		///console.log('RES', tmpl.toHTML());*/
	})
	
	it('testing var fields', () => {
		var tmpl = Ozenfant.prepare(`
			.
				h4 
					"User"
				.$user.name
				.$user.surname
								
		
		`);
		tmpl = new Ozenfant(tmpl);
		var rnode = document.querySelector(".test-var-fields");
		tmpl.render(rnode, {
			user: {
				name: 'Mykola',
				surname: 'Oleksiienko'
			}
		});
		console.log('______', tmpl);
		tmpl.set('user', {
			name: 'Grytsko',
			surname: 'Dughelnyi',
		});
	})
	
	it('testing syntax terror 1', () => {
			var create_tmpl = () => {
				var tmpl = new Ozenfant(`
					.a
						.b
						.c(some unfinished bracket
					.e
				`);
			}
			assert.throws(create_tmpl, Error, "Cannot parse template");
	})
	it('testing syntax terror 2', () => {
			var create_tmpl = () => {
				var tmpl = new Ozenfant(`
					.a
						,.b
						.c
					.e
				`);
			}
			assert.throws(create_tmpl, Error, "Cannot parse template");
	})
})
//*/

