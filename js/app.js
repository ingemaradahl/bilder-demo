/*jslint browser: true smarttabs: true */ /*global config $ jQuery sprintf templates Editor vec2 vec3 vec4 */

function App() {
	"use strict";

	if (App.prototype.__instance)
		return App.prototype.__instance;
	App.prototype.__instance = this;

	this.error = new ErrorDisplay();
	this.messages = new MessageBus();
	this.imgCache = {}; // Cache of WebGL textures
	this.inputs = new Inputs();
	this.program = null;

	this.messages.subscribe("new-input-controls", this.inputs.addInputs);

	var canvas = $("canvas");
	var controls = $("#app-inputs");
	this.gl = null; // DEBUGGING

	var gl = null;

	var buildInputGUI = function() {

	}.bind(this);


	this.initGL = function () {
		this.gl = canvas[0].getContext("experimental-webgl") ||
					canvas[0].getContext("webgl");

		if (!this.gl) {
			this.error.post("Unable to initialize WebGL");
			Editor().disableCompile();
			return;
		}

		gl = this.gl;
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
	};

	/*
	 * Returns WebGL texture
	 */
	this.getGLImage = function(url) {
		if (!(url in this.imgCache))
			return null;

		return this.imgCache[url];
	};

	/*
	 * Loads an image url into a WebGL texture and emits the "new-gl-image"
	 * message. If a callback is given, it will be called as well.
	 *
	 * The message body/callback argument is { url: string, texture: gl-texture}
	 */
	this.loadImage = function(url, callback) {
		var image = new Image();

		function isPowerOfTwo(x) {
			return (x & (x - 1)) === 0;
		}

		function nextHighestPowerOfTwo(x) {
			--x;
			for (var i = 1; i < 32; i <<= 1) {
				x = x | x >> i;
			}
			return x + 1;
		}

		var finalize = function() {
			//Images might have to be resized, see
			//http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences#Non-Power_of_Two_Texture_Support
			if (!isPowerOfTwo(image.width) || !isPowerOfTwo(image.height)) {
				// Scale up the texture to the next highest power of two dimensions.
				var canvas = document.createElement("canvas");
				canvas.width = nextHighestPowerOfTwo(image.width);
				canvas.height = nextHighestPowerOfTwo(image.height);
				var ctx = canvas.getContext("2d");
				ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
				image = canvas;
			}

			var texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			try {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			}
			catch (exc) {
				gl.deleteTexture(texture);
				App().error.post(sprintf("While loading '%s': %s", url, exc.message));
				return null;
			}

			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

			this.messages.post("new-gl-image", {url: url, texture: texture});

			this.imgCache[url] = texture;

			if (callback)
				callback({url: url, texture: texture});
		}.bind(this);

		var onerror = function() {
			App().error.post('Unable to load image "' + image.src + '".');
			image = null;
		}.bind(this);

		image.onload = finalize;
		image.onerror = onerror;
		image.crossOrigin = "anonymous";
		image.src = url;
	};

	this.refresh = function () {
		canvas[0].width = canvas.width();
		canvas[0].height = canvas.height();

		// TODO: Improve this, and maybe even remove when programs are run in
		// real time. Also set new viewport dimension and resolution uniform
		// values
		if (App().program) {
			App().program.run();
		}

		controls.height($("canvas").innerHeight() - $(0.8).toPx());
		$("#editor").position({my: "left top", at: "left bottom", of: "canvas", offset: "0em 6em"});

		controls.position({my: "left top", at: "right top", of: "canvas", offset: "6em 0em"});
		controls.width($(window).width() - controls.position().left - $(1.8).toPx());
	};

	this.resolution = function() {
		return vec2.createFrom(canvas[0].width, canvas[0].height);
	};

	this.buildProgram = function(p) {
		buildInputGUI();
		if (this.program)
			this.program.destroy();
		this.program = new Program(gl, p);
		this.messages.post("new-input-controls", this.program.inputs);
	};

	var setInput = function(inputs) {
		if (this.program)
			this.program.setInputs(inputs);
	}.bind(this);

	canvas.resizable({resize: this.refresh});
	this.messages.subscribe("new-inputs", setInput);
	this.refresh();
}

var Program = (function() {
	var compileVertex = function(gl) {
		var shader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(shader, config.glsl.vertex);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			var errmsg = sprintf(
				"While compiling built in vertex shader:\n%s",
				gl.getShaderInfoLog(shader)
			);
			App().error.post(errmsg, "Shader Error");
			return null;
		}

		return shader;
	};

	var vertexShader = null;
	var vertices = [ -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0 ];
	var quad = null;

	return function(gl, program) {
		if (!vertexShader) {
			vertexShader = compileVertex(gl);
			if (!vertexShader) {
				Editor().disableCompile();
				return;
			}
		}

		if (!quad) {
			quad = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
		}

		this.inputs = {}; // { name: type }
		var inputValues = {}; // { name: value }
		var framebuffers = {}; // { name: gl.frameBuffer }
		var pipeline = []; // Order of execution: [ {shader: string, output: string } ]

		var glPrograms = {};
		var graph = program.graph;

		var prependGLSLHeader = function (src) {
			var precision = config.glsl.precision;
			for (var type in {float: null}) {
				src = templates.glsl.precision(precision, type) + src;
			}

			return src;
		};

		var compileShader = function(shaderObj) {
			var src = shaderObj.shader;
			src = prependGLSLHeader(src);

			var shader = gl.createShader(gl.FRAGMENT_SHADER);
			gl.shaderSource(shader, src);
			gl.compileShader(shader);

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				var errmsg = sprintf(
					"While compiling %s:\n%s",
					shaderObj.name,
					gl.getShaderInfoLog(shader)
				);
				App().error.post(errmsg, "Shader Error");
				console.log(src);
				return null;
			}

			var program = gl.createProgram();
			gl.attachShader(program, vertexShader);
			gl.attachShader(program, shader);
			gl.linkProgram(program);

			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				var linkerr = sprintf(
					"While linking program %s:\n%s",
					shaderObj.name,
					"LINK ERROR"
				);
				App().error.post(linkerr, "Shader Error");
				return null;
			}

			program.positionAttrib = gl.getAttribLocation(program, "aVertexPosition");
			gl.enableVertexAttribArray(program.position0Attrib);

			program.uniforms = {};
			var uniforms = findUniforms(shaderObj.name, graph);
			for (var name in uniforms) {
				program.uniforms[name] = gl.getUniformLocation(program, name);

				// Some programs may have their uniforms unreferenced, which
				// means that the GLSL compiler will optimize them away..
				if (program.uniforms[name])
					program.uniforms[name].type = uniforms[name];
				else
					delete program.uniforms[name];
			}

			Editor().stopLoadAnim();
			return program;
		};

		/*
		 * Finds all uniforms used by the given GLSL shader.
		 *
		 * returns { name : type}
		 */
		var findUniforms = function(shader, graph) {
			var inputs = {};

			var find = function(g) {
				if (g.filename === shader) {
					for (var i=0; i<g.inputs.length; i++) {
						var input = g.inputs[i];

						if (input.name in inputs)
							continue;

						if (input.type === "node") {
							inputs[input.name] = "texture";
							find(input.node);
						}
						else
							inputs[input.name] = input.type;
					}
				}
				else {
					for (var j=0; j<g.inputs.length; j++) {
						var input_ = g.inputs[j];
						if (input_.type === "node")
							find(input_.node);
					}
				}
			};

			find(graph);
			return inputs;
		};

		/*
		 * Collects all possible uniforms for the entire filter program, and
		 * stores the result in this.inputs as a dict of { name: type }
		 */
		var collectInputs = function(graph) {
			var inputs = {};

			var collect = function (graph) {
				for (var i=0; i<graph.inputs.length; i++) {
					var input = graph.inputs[i];

					if (input.name in inputs)
						continue;

					if (input.type === "node")
						collect(input.node);
					else if (input.name !== config.glsl.resolutionUniform)
						inputs[input.name] = input.type;
				}
			};

			collect(graph);

			return inputs;
		};

		/*
		 * Creates a set of framebuffers and corresponding textures used for
		 * intermediate render values
		 */
		var createRenderTargets = function(graph) {
			var framebuffers = {};

			var createFramebuffer = function(name) {
				var framebuffer = gl.createFramebuffer();
				gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

				var texture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, config.framebufferSize,
						config.framebufferSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

				framebuffer.texture = texture;
				framebuffer.name = name;
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);

				return framebuffer;
			};

			var collect = function(graph) {
				for (var i=0; i<graph.inputs.length; i++) {
					var input = graph.inputs[i];

					if (input.name in framebuffers)
						continue;

					if (input.type === "node") {
						framebuffers[input.name] = createFramebuffer(input.name);
						collect(input.node);
					}
				}
			};

			collect(graph);
			return framebuffers;
		};

		/*
		 * Creates a pipeline of shaders; essentially a list determening in
		 * which order shaders are to be executed
		 */
		createPipeline = function(graph) {
			var order = [];
			var output = null;

			var collect = function(graph) {
				var shader = graph.filename;
				order.unshift({shader: shader, output: output});

				for (var i=0; i<graph.inputs.length; i++) {
					var input = graph.inputs[i];

					if (input.type === "node") {
						output = input.name;
						collect(input.node);
					}
				}
			};

			collect(graph);

			return order;
		};

		var newImage = function (img) {
			if (!img || !img.url || !img.texture)
				return;

			// Find missing textures
			var missing = 0;
			for (var name in inputValues) {
				if (inputValues[name] === img.url) {
					inputValues[name] = img.texture;
				}
				else if (typeof(inputValues[name]) === "string") {
					missing++;
				}
			}

			// A bit tacky to do this here, but whatever :P
			if (missing === 0)
				this.run();
		}.bind(this);

		/*
		 * Run the given shader, fetching inputs from the program object.
		 * Defaults by writing to standard framebuffer, but can optionally write
		 * to given framebuffer.
		 */
		var runShader = function (shader, output) {
			var program;
			var textureUnit = 0;
			var value;
			var res;

			if (typeof(shader) === "string")
				program = glPrograms[shader];
			else
				program = shader;

			if (output) {
				if (typeof(output) === "string") {
					output = framebuffers[output];
				}

				if (!gl.isFramebuffer(output))
					throw "Bad framebuffer";

				res = vec2.createFrom(config.framebufferSize, config.framebufferSize);
			}
			else {
				output = null;
				res = App().resolution();
			}

			gl.bindFramebuffer(gl.FRAMEBUFFER, output);
			gl.viewport(0, 0, res[0], res[1]);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.useProgram(program);

			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			gl.vertexAttribPointer(program.positionAttrib, 2, gl.FLOAT, false, 0, 0);

			for (var name in program.uniforms) {
				var resource;
				var type;
				if (name in inputValues) {
					resource = inputValues;
					type = "";
				}
				else if (name in framebuffers) {
					resource = framebuffers;
					type = "framebuffer";
				}
				else if (name === config.glsl.resolutionUniform) {
					resource = {};
					resource[config.glsl.resolutionUniform] = res;
				}
				else {
					App().error.post(sprintf("Input value '%s' not set", name));
					return;
				}

				var uniform = program.uniforms[name];
				var binder = null;

				value = resource[name];
				switch(uniform.type) {
				case "vec2":
					binder = gl.uniform2fv.bind(gl);
					break;
				case "vec3":
					binder = gl.uniform3fv.bind(gl);
					break;
				case "vec4":
					binder = gl.uniform4fv.bind(gl);
					break;
				case "float":
					binder = gl.uniform1f.bind(gl);
					break;
				case "texture":
					value = textureUnit++;
					gl.activeTexture(gl.TEXTURE0 + value);
					gl.bindTexture(gl.TEXTURE_2D, (type === "framebuffer") ? resource[name].texture : resource[name]);
					/* falls through */
				case "int":
					binder = gl.uniform1i.bind(gl);
					break;
				default:
					console.log("Bad uniform type: '%s' for '%s'", typeof(uniform.type), name);
					return;
				}

				binder(uniform, value);
			}

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		}.bind(this);

		this.run = function() {
			for (var i=0; i<pipeline.length; i++) {
				var pass = pipeline[i];
				runShader(pass.shader, pass.output);
			}
		};

		this.setInputs = function(inputs) {
			inputs = inputs || {};

			var mustWait = false;
			for (var name in this.inputs) {
				var type = this.inputs[name];
				var value = inputs[name];

				if (value === undefined || value === null)
					continue;

				switch (type) {
				case "float":
				case "int":
					if (typeof(value) !== "number") {
						console.log(sprintf("Bad value for input %s: %s", name, value));
						return;
					}
					inputValues[name] = value;
					break;
				case "vec2":
				case "vec3":
				case "vec4":
					if (!value || value.constructor !== Float32Array) {
						console.log(sprintf("Bad value for input %s: %s", name, value));
						return;
					}
					inputValues[name] = value;
					break;
				case "texture":
					if (typeof(value) === "string") {
						var url = value;
						if (url in App().imgCache) {
							inputValues[name] = App().getGLImage(url);
						}
						else {
							App().loadImage(url);
							inputValues[name] = url;
							mustWait = true;
						}
					}
					break;
				}
			}

			if (!mustWait)
				this.run(inputValues);
		};

		this.destroy = function() {
			App().messages.unsubscribe("new-gl-image", newImage);

			for (var name in glPrograms) {
				if (glPrograms[name])
					gl.deleteProgram(glPrograms[name]);
			}

			for (var fb in framebuffers) {
				var framebuffer = framebuffers[fb];
				gl.deleteTexture(framebuffer.texture);
				gl.deleteFramebuffer(framebuffer);
			}

			glPrograms = null;
			inputValues = null;
			framebuffers = null;
		};

		this.debug = function(pass) {
			for (var i=0; i<program.shaders.length; i++) {
				var name = program.shaders[i].name;
				var src = program.shaders[i].shader;

				Editor().newFile(sprintf("debug/%d_%s", pass, name), src);
			}
		};

		// Compile shaders
		for (var i=0; i<program.shaders.length; i++) {
			var name = program.shaders[i].name;
			glPrograms[name] = compileShader(program.shaders[i]);

			if (!glPrograms[name]) {
				// Abort!
				this.destroy();
				return;
			}
		}

		this.inputs = collectInputs(graph);
		framebuffers = createRenderTargets(graph);
		pipeline = createPipeline(graph);

		App().messages.subscribe("new-gl-image", newImage);
		//App().messages.post("new-input-controls", this.inputs);
	};
})();

function Inputs() {
	"use strict";

	var input_values = {};
	var boxed_values = {};

	/*
	 * Sends all the input values.
	 */
	var sendInputs = (function() {
		var timeoutId = null;

		var tell = function() { App().messages.post("new-inputs", input_values); };

		return function(force) {
			if (force) {
				clearTimeout(timeoutId);
				tell();
			}

			clearTimeout(timeoutId);
			timeoutId = setTimeout(tell, config.inputDelay);
		};
	})();

	/*
	 * Get old value
	 */
	var getOldValue = function(name, def) {
		var old_values = boxed_values || {};
		if (name in old_values)
			return old_values[name];
		else
			return def;
	}.bind(this);

	/*
	 * Strips HTML tags from a string.
	 */
	var stripHTML = function(html) {
		var tmp = $('<div/>');
		tmp.html(html);
		return tmp[0].textContent||tmp[0].innerText;
	};

	/*
	 * Input widget box
	 */
	var createBox = function(name, type, extra_options, elems, resetfun) {
		// input box
		var outer_div = $('<div class="app-input ui-widget-border ui-corner-all ui-widget"/>');

		// options
		var options = $('<div class="app-input-options"></div>');
		options.append($('<button class="option-reset">&nbsp;</button>').button({icons: {primary: "ui-icon-trash"}, text: false}).click(resetfun));
		for (var opt in extra_options)
			options.prepend(extra_options[opt]);

		// title
		var title = $('<div class="app-input-title"/>');
		title.append('<span class="app-input-name">' + name + '</span>');
		title.append(options);
		title.append('<span class="app-input-type">' + type + '</span>');
		title.append('<div style="clear: both;"/>');

		// body
		var body = $('<div class="app-input-body"></body>');

		for (var elem in elems)
			body.append(elems[elem]);

		outer_div.append(title);
		outer_div.append(body);

		return outer_div;
	};

	/*
	 * All input widgets.
	 */
	var textureWidget = function(name) {
		var options = [$('<button class="option-local">&nbsp;</button>').button({icons: {primary: "ui-icon-folder-open"}, text: false})];

		var body = [];
		body.push('<div class="input-body-title">url</div>');

		var value = getOldValue(name, config.defaultImage);

		// input box
		var input = $('<div contenteditable="true" class="textbox ui-widget-content ui-corner-all"><p>' + value + '</p></div>');

		// preview image
		var preview = $('<img class="preview ui-widget-content ui-corner-all"/>');

		// initial value
		input_values[name] = value;
		preview.attr('src', value);

		// events (on change)
		var onUpdate = function(e, force) {
			var value = stripHTML(input.html());
			input_values[name] = value;
			boxed_values[name] = value;
			preview.attr('src', value);
			sendInputs(force);
		};
		input.change(onUpdate);
		input.bind('keypress', function(e) { if (e.keyCode === 13) onUpdate(e, true); });

		body.push(input);
		body.push(preview);

		// reset function
		var reset = function() {
			input.html('<p>' + config.defaultImage + '</p>');
			input.trigger('change');
		};

		return createBox(name, "texture", options, body, reset);
	};
	var numberWidget = function(type) {
		return function(name) {
			var default_value = "0";

			var value = getOldValue(name, default_value);

			// input box
			var input = $('<div contenteditable="true" class="textbox ui-widget-content ui-corner-all"><p>' + value + '</p></div>');

			// initial value
			if (type == "float")
				input_values[name] = parseFloat(value);
			else
				input_values[name] = parseInt(value, 10);

			// events (on change)
			var onUpdate = function() {
				var value = stripHTML(input.html());
				boxed_values[name] = value;
				if (type == "float")
					input_values[name] = parseFloat(value);
				else
					input_values[name] = parseInt(value, 10);
				sendInputs();
			};
			input.change(onUpdate);

			// reset function
			var reset = function() {
				input.html('<p>' + default_value + '</p>');
				input.trigger('change');
			};

			return createBox(name, type, [], [input], reset);
		};
	};
	var vectorWidget = function(size) {
		return function(name) {
			var default_value = [0,0,0,0];

			// events (on change)
			var field_values = [];

			var old_values = getOldValue(name, default_value);

			var updateValues = function() {
				var fun = {2: vec2, 3: vec3, 4: vec4}[size];
				input_values[name] = fun.createFrom.apply(fun, field_values);
				boxed_values[name] = field_values;
			};
			var onUpdate = function(index) {
				return function() {
					field_values[index] = this.textContent;
					updateValues();
					sendInputs();
				};
			};

			var body = [];
			var boxes = [];
			// input boxes
			var names = {0: 'x', 1: 'y', 2: 'z', 3: 'w'};
			for (var i=0; i<size; i++) {
				var input_body = $('<div><div class="input-body-title">' + names[i] + '</div></div>');
				var input = $('<div contenteditable="true" class="textbox ui-widget-content ui-corner-all"><p>' + old_values[i] + '</p></div>');
				boxes.push(input);

				// initial value
				field_values[i] = old_values[i];

				input.change(onUpdate(i));
				input_body.append(input);
				// add space between inputs (but not for the last).
				if (i < (size-1))
					input_body.append('<div style="height: 0.8em;"/>');
				body.push(input_body);
			}

			updateValues();

			// reset function
			var reset = function() {
				for (var i=0; i<size; i++) {
					boxes[i].html('<p>' + default_value[i] + '</p>');
					boxes[i].trigger('change');
				}
			};

			return createBox(name, "vec" + size, [], body, reset);
		};
	};
	var widgets = {
			'texture': textureWidget,
			'float': numberWidget("float"),
			'int': numberWidget("int"),
			'vec2': vectorWidget(2),
			'vec3': vectorWidget(3),
			'vec4': vectorWidget(4)
		};

	/*
	 * Called by MessageBus when there are new inputs from a shader.
	 */
	this.addInputs = function(ins) {
		var panel = $("#app-inputs-widgets");

		// clean up.
		input_values = {};
		panel.html("");

		// create widgets for all the inputs.
		for (var name in ins) {
			panel.append(widgets[ins[name]](name));
		}

		// sort them after height.
		var sortByHeight = function(a, b) {
			return $(a).height() < $(b).height();
		};
		$("#app-inputs-widgets > div").sort(sortByHeight).appendTo("#app-inputs-widgets");

		// and do an initial input update.
		sendInputs();
	}.bind(this);
}

function ErrorDisplay() {
	"use strict";

	var errorBox = $("#error-box");
	var errors = [];

	var nl2br = function(str) {
		return str.replace(/\n/g, "<br>");
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

	var InfoMessage = function(str, type) {
		type = type || "Warning";
		var box = $(templates.info(type, nl2br(str))).appendTo(errorBox).fadeIn();

		this.destroy = function() {
			box.fadeOut(function() { box.remove(); });

			for (var i=0; i<errors.length; i++) {
				if (errors[i] === this)
					delete errors[i];
			}
		};

		setTimeout(this.destroy.bind(this), 5000);
		box.find(".ui-icon-close").click(this.destroy.bind(this));
	};

	this.post = function(str, type) {
		Editor().stopLoadAnim();
		errors.push(new ErrorMessage(str, type));
	};

	this.postWarning = function(str, type) {
		errors.push(new InfoMessage(str, type));
	};

	this.clear = function() {
		for (var i=0; i<errors.length; i++) {
			if(errors[i])
				errors[i].destroy();
		}

		errors = [];
	};
}

function MessageBus() {
	"use strict";

	var routing = {};

	this.subscribe = function(title, fn) {
		if (!(title in routing))
			routing[title] = [];

		routing[title].push(fn);
	};

	this.unsubscribe = function(title, fn) {
		if (!(title in routing))
			return;

		for (var i=0; i<routing[title].length; i++) {
			if (routing[title][i] === fn)
				delete routing[title][i];
		}
	};

	this.post = function(title, message) {
		if (!(title in routing))
			return;

		for (var i=0; i<routing[title].length; i++) {
			if (routing[title][i])
				routing[title][i](message);
		}
	};
}

/*
 * make contentEditable elements trigger change-event.
 */
$('[contenteditable]').live('focus', function() {
    var $this = $(this);
    $this.data('before', $this.html());
    return $this;
}).live('blur keyup paste', function() {
    var $this = $(this);
    if ($this.data('before') !== $this.html()) {
        $this.data('before', $this.html());
        $this.trigger('change');
    }
    return $this;
});
