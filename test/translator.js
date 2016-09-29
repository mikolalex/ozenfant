var $ = require('jquery');
var Ozenfant = require('../ozenfant');

$(function(){
	$("#input").keyup(function(){
		var tmpl = new Ozenfant($(this).val());
		var html = tmpl.toHTML({});
		console.log('html', html, $(this).html());
		$("#output").text(html);
	})
})