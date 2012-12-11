/*jslint browser: true smarttabs: true */ /*global config $ jQuery sprintf templates */

function App() {
	"use strict";

	if (App.prototype.__instance)
		return App.prototype.__instance;
	App.prototype.__instance = this;

	var canvas = $("canvas");
	this.error = new ErrorDisplay();
	this.gl = null;

	var compileShader = function(shader) {
	};

	this.initGL = function () {
		this.gl = canvas[0].getContext("experimental-webgl") ||
					canvas[0].getContext("webgl");

		var gl = this.gl;
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	};

	this.runShaders = function (shaders) {
		var apa = "bepa";
	};

}

function ErrorDisplay() {
	"use strict";

	var errorBox = $("#error-box");
	var errors = [];

	var nl2br = function(str) {
		return str.replace(/\n/, "</br>");
	};

	var ErrorMessage = function(str, type) {
		type = type || "Error";
		var box = $(templates.error(type, nl2br(str))).appendTo(errorBox).fadeIn();

		this.destroy = function() {
			box.fadeOut(function() { box.remove(); });

			for (var i=0; i<errors.length; i++) {
				if (errors[i] === this)
					delete errors[i];
			}
		};

		box.find(".ui-icon-close").click(this.destroy.bind(this));
	};

	this.post = function(str, type) {
		errors.push(new ErrorMessage(str, type));
	};

	this.clear = function() {
		for (var i=0; i<errors.length; i++) {
			if(errors[i])
				errors[i].destroy();
		}

		errors = [];
	};

}
