/*jslint browser: true smarttabs: true*/ /*global config $ jQuery sprintf templates CodeMirror */

function Editor() {
	"use strict";

	if (Editor.prototype.__instance)
		return Editor.prototype.__instance;
	Editor.prototype.__instance = this;

	var tabs = [];
	var files = [];

	// TODO: temporary debugging
	this.files = files;

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

			this[i].destroy();
			delete this[i];

			return;
		}
	}.bind(tabs);

	/* Creates a new, unused file name */
	var newName = (function() {
		var _untitled = 0;
		return function () { return sprintf(config.newName, _untitled++); };
	})();


	var File = (function () {
		var _counter = 0;
		var _tree = $("#editor-tree");
		var _editor = new Editor();

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
		var _editor = Editor(); // JSLint complains about missing new

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

			this.open = function() {
				_tabs.tabs("select", index());
			};

			/* Flush content of CodeMirror instance to file object */
			this.flush = function() {
				this.file.data = _codemirror.getValue();
			};

			this.destroy = function() {
				$('li[aria-controls="'+this.id+'"]').remove();
				$("#"+this.id).remove();
				_editor.refresh();

			/*
			 *    $( "#tabs span.ui-icon-close" ).live( "click", function() {
             *var panelId = $( this ).closest( "li" ).remove().attr( "aria-controls" );
             *$( "#" + panelId ).remove();
             *tabs.tabs( "refresh" );
			 */
			};
		};
	})();

	this.initGUI = function() {
		var tabs = $("#editor-tabs");
		var tree = $("#editor-tree");

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
				//Editor().newFile();
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

		if (files.findByName(name))
			return; // TODO ERROR

		var f = new File(name, data);
		files.push(f);

		// If no files are open, open this file!
		/*
		 *if ($("#editor-tabs").tabs("option", "selected") < 0)
		 *{
		 *    this.open(f);
		 *}
		 */
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
	this.compile = function(success, failure) {
		this.flush();

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
			//dataType: 'json',
			success: success,
			error: failure
		});
	};
}

