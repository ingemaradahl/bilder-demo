/*jslint smarttabs:true */
/*
 *     This file is part of Bilder.
 *
 *  Bilder is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Lesser General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  Bilder is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with Bilder.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  Copyright © 2012-2013 Filip Lundborg
 *  Copyright © 2012-2013 Ingemar Ådahl
 */

var templates = {
	editor : {
		tab : "<li>" +
		      "<a href='#{href}'>#{label}</a>" +
		      "<span class='ui-icon ui-icon-close'>Remove Tab</span>" +
		      "</li>",
		container : '<div id="#{id}" class="editor-file-editor"></div>',
		file : "<li>" +
		       "<a href='#{href}'>#{label}</a>" +
		       "</li>"
	},
	error: '<div class="ui-widget ui-state-error ui-corner-all"><p>' +
	       '<span class="ui-icon ui-icon-close">Close Error</span>' +
	       '<div>' +
	       '<span class="ui-icon ui-icon-alert"/>' +
	       '<strong>#{title}</strong></p><p>#{body}</p></div>' +
	       '</div>',
	info:  '<div class="ui-widget ui-state-highlight ui-corner-all"><p>' +
	       '<span class="ui-icon ui-icon-close">Close Info</span>' +
	       '<div>' +
	       '<span class="ui-icon ui-icon-info"/>' +
	       '<strong>#{title}</strong></p><p>#{body}</p></div>' +
	       '</div>',
	inputs : {
		title : '<div class="input-title">#{content}</div>',
		box : {
			outer : '<div class="app-input ui-widget-border ui-corner-all ui-widget" />',
			title : '<span class="app-input-name">#{name}</span>' +
			        '<span class="app-input-type">#{type}</span>',
			body : '<div class="app-input-body"/>',
			reset : '<button class="option-reset">&nbsp;</button>',
			options : '<div class="app-input-options"></div>'
		},
		texture : {
			input : '<div contenteditable="true" class="textbox ui-widget-content ui-corner-all">' +
			        '<p>#{value}</p>' +
			        '</div>',
			loadbutton : '<button class="option-local">&nbsp;</button>',
			preview : '<img class="preview ui-widget-content ui-corner-all"/>'
		},
		number : {
			input : '<div contenteditable="true" class="textbox ui-widget-content ui-corner-all">' +
			        '<p>#{value}</p>' +
					  '</div>'
		},
		vector : {
			input : '<div contenteditable="true" class="textbox ui-widget-content ui-corner-all">' +
			        '<p>#{value}</p>' +
					  '</div>',
			body : '<div><div class="input-body-title">#{name}</div></div>'
		}
	},
	glsl: {
		precision: "precision #{precision} #{type};\n"
	}
};

(function() {
"using strict";

/*
 * Templates are executed with regular expressions, matching fields defined
 * as '#{field}'
 */
var fieldRegExp = /#\{\w+\}/gm;
var escape = function(pattern) {
	return pattern.replace(/(\W)/g, "\\$1");
};
var keyRegExp = function(key) {
	return new RegExp("#\\{"+key+"\\}", "g");
};

var initTemplate = function(template) {
	var matches = template.match(fieldRegExp);

	if (matches === null)
		return function() { return template; };

	var fields = Array(matches.length);
	for (var i=0; i<matches.length; i++)
		fields[i] = matches[i].match(/\w+/)[0];

	var f = function(o) {
		var str = template;

		if (arguments.length === 0)
			return str;

		switch (typeof(arguments[0])) {
		case "string":
			// String-as-argument mode
			for (var i=0; i<arguments.length && i<matches.length; i++)
				str = str.replace(new RegExp(matches[i], "g"), arguments[i]);

			break;
		case "object":
			// Dictionary-as-argumen mode
			for (var key in o) {
				if (typeof(o[key]) !== "string")
					continue;

				var pattern = escape(key);
				str = str.replace(keyRegExp(pattern), o[key]);
			}

			break;
		}

		return str;
	};

	f.fields = fields;
	return f;
};

var initLevel = function(o) {
	for (var l in o) {
		switch(typeof(o[l])) {
		case "object":
			initLevel(o[l]);
			break;
		case "string":
			o[l] = initTemplate(o[l]);
			break;
		}
	}
};

initLevel(templates);

}());
