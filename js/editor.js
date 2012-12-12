/*jslint browser: true smarttabs: true */ /*global config $ jQuery sprintf templates CodeMirror App */

function Editor() {
	"use strict";

	if (Editor.prototype.__instance)
		return Editor.prototype.__instance;
	Editor.prototype.__instance = this;

	var tabs = [];
	var files = [];

	var makeFinder = function(that, attribute) {
		var f = function (name) {
			for (var i=0; i<this.length; i++) {
				if (!this[i])
					continue;

				if (this[i][attribute] === name)
					return this[i];
			}
		};

		return f.bind(that);
	};

	// Find a file given it's name
	files.findByName = makeFinder(files, "name");

	// Find a tab given a file
	tabs.findByFile = makeFinder(tabs, "file");

	// Find a tab given a tab id
	tabs.findById = makeFinder(tabs, "id");

	// Remove a tab given a tab id
	tabs.remove = function(id) {
		for (var i=0; i<this.length; i++) {
			if (!this[i] || this[i].id !== id)
				continue;

			var tab = this[i];
			delete this[i];
			tab.destroy();

			return;
		}
	}.bind(tabs);

	// Whether the tab array is empty or not
	tabs.empty = function() {
		var c = 0;
		for (var i=0; i<this.length; i++) {
			if (this[i])
				c++;
		}

		if (c === 0) {
			// Clean list
			this.length = 0;
			return true;
		}

		return false;
	}.bind(tabs);

	/* Creates a new, unused file name */
	var newName = (function() {
		var _untitled = 0;
		return function () { return sprintf(config.newName, _untitled++); };
	})();


	var File = (function () {
		var _counter = 0;
		var _tree = $("#editor-tree > div");

		return function (name, data) {
			this.id = sprintf("editor-file-%d", _counter++);
			this.name = name;
			this.data = data;

			_tree.tree('appendNode', { label: name, file: this});

			this.toJSON = function () {
				return { name: this.name, data: this.data };
			};
		};
	})();

	var Tab = (function () {
		var _counter = 0;
		var _tabs = $("#editor-tabs");
		var _editor = Editor();

		return function (file) {
			this.id = sprintf("editor-tab-%d", _counter++);
			this.file = file;

			var _codemirrorDiv = null;
			var _codemirror = null;
			var _label = null;

			var addTab = function() {
				_label = _tabs.find(".ui-tabs-nav").append(
					templates.editor.tab({
						href: "#"+this.id,
						label: this.label
				}));

				_label.disableSelection();
				_tabs.append(templates.editor.container(this.id));
				_label.find("span.ui-icon-close")
					.live("click", function() {
						var tabid = $(this).siblings("a").attr("href");
						tabs.remove(tabid.substr(1));
					});
				_codemirrorDiv = $("div #"+this.id);
				_codemirror = new CodeMirror(_codemirrorDiv[0], {
					value: this.file.data,
					keyMap: "vim",
					lineNumbers: true,
					matchBrackets: true
				});

				_codemirrorDiv.find("> div").addClass("ui-corner-all ui-widget ui-widget-container");

				_editor.refresh();
			}.bind(this);

			var index = function() {
				return _label.find('li a[href="#'+this.id+'"]').parent().index();
			}.bind(this);

			if (this.file) {
				this.label = file.name;
				this.content = file.data;
			} else {
				this.label = newName();
				this.content = "";
			}

			addTab();

			this.open = function(line, column) {
				_tabs.tabs("select", index());

				if (line > -1 && column > -1) {
					_codemirror.scrollIntoView({line: line, ch: column});
					// TODO: flash line
				}

			};

			/* Flush content of CodeMirror instance to file object */
			this.flush = function() {
				this.file.data = _codemirror.getValue();
			};

			this.destroy = function() {
				$('li[aria-controls="'+this.id+'"]').remove();
				$("#"+this.id).remove();

				// Always have one tab open
				if (tabs.empty())
					_editor.newFile();

				_editor.refresh();

			};
		};
	})();

	this.startLoadAnim = function() {
		$("#editor-toolbar-loader").fadeIn();
	};

	this.stopLoadAnim = function() {
		$("#editor-toolbar-loader").fadeOut();
	};

	var showError = function(error) {
		var typeDict = {
			type: "Type Error",
			compiler: "Compiler Error",
			syntax: "Syntax Error"
		};

		App().error.post(sprintf("In file %s\n%s", error.file, error.message),
		                 typeDict[error.type]);

		if (error.column > -1 && error.line > -1)
			setPosition(error.file, error.line, error.column);
	}.bind(this);

	var showWarnings = function(warnings) {
	};

	var setPosition = function(file, line, column) {
		var tab = tabs.findByFile(files.findByName(file));

		if (tab)
			tab.open(line, column);
	};

	this.initGUI = function() {
		var tabs = $("#editor-tabs");
		var tree = $("#editor-tree > div");

		if (!tabs.size() || !tree.size())
			return;

		tabs.tabs();
		tree.tree({
			data: {},
			autoOpen: true,
			slide: false
		});

		tree.bind('tree.click', function(event) {
			var node = event.node;
			Editor().open(node.file);
		});

		$("#editor-button-compile")
			.button({
				text: true,
				icons: { primary: "ui-icon-wrench"}
			})
			.click(function() {
				Editor().compile();
			});

		$("#editor-button-newfile")
			.button({
				text: true,
				icons: { primary: "ui-icon-plus"}
			})
			.click(function() {
				$("#editor-dialog-newfile").dialog("open");
			});

		$("#editor-dialog-newfile")
			.dialog({
				autoOpen: false,
				modal: true,
				buttons: {
					Ok: function() {
						var name = $(this).find("#editor-dialog-newfile-name")[0].value;
						Editor().newFile(name);
						$(this).dialog("close");
					},
					Cancel: function() {
						$(this).dialog("close");
					}
				},
				close: function() {
					$(this).find("form")[0].reset();
				}
			});
	};

	/* Writes content of codemirror instances to file objects */
	this.flush = function() {
		for (var i=0; i<tabs.length; i++) {
			if (!tabs[i])
				continue;

			tabs[i].flush();
		}
	};

	// Open a file
	this.open = function(file) {
		if (!file)
			return;

		var tab = tabs.findByFile(file);
		if (tab) {
			tab.open();
			return;
		}

		tab = new Tab(file);
		tabs.push(tab);
		tab.open();
	};

	this.refresh = function() {
		$("#editor-tabs").tabs("refresh");
		//$("#editor-tree").filetree("refresh");
	};

	this.newFile = function(name, data) {
		name = name || newName();
		data = data || "";

		if (files.findByName(name)) {
			App().error.post(sprintf("File '%s' already exists!", name));
			return;
		}

		var f = new File(name, data);
		files.push(f);

		this.open(f);
	};

	/* Download file from host */
	this.fetch = function(files) {
		switch(typeof(files)) {
		case "object":
			if (files.constructor.name !== "Array")
				return;

			for (var i=0; i<files.length; i++) {
				this.fetch(files[i]);
			}

			break;
		case "string":
			var file = files;
			jQuery.ajax(file, {
				dataType: 'text',
				success: this.newFile.bind(this, file)
			});
			break;

		}
	};

	/* Upload open files to compiler */
	this.compile = function() {
		this.flush();
		App().error.clear();

		var fs = [];

		for (var i=0; i<tabs.length; i++) {
			if (!tabs[i])
				continue;

			fs.push(tabs[i].file.toJSON());
		}

		var shaders = { files: fs };

		jQuery.ajax(config.compilerURL, {
			type: 'POST',
			data: shaders,
			dataType: 'json',
			success: function (data) {
				if (!data) {
					App().error.post("Bad response from compiler");
					return;
				}

				if (data.error.message) {
					showError(data.error);
					return;
				}

				if (data.warnings.length)
					showWarnings(data.warnings);

				App().buildProgram(data.data);
			},
			error: function(err) {
				// TODO: nicer error..
				App().error.post(err.responseText);
			}
		});

		this.startLoadAnim();
	};

	this.disableCompile = function() {
		$("#editor-button-compile").button("disable");
	};

	this.enableCompile = function() {
		$("#editor-button-compile").button("enable");
	};
}

