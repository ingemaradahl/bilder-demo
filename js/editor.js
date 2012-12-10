/*jslint browser: true smarttabs: true*/ /*global config $ jQuery sprintf templates */

function Editor() {
	"use strict";

	if (Editor.prototype.__instance)
		return Editor.prototype.__instance;
	Editor.prototype.__instance = this;

	var tabs = [];
	var files = [];

	// Find a file given it's name
	files.find = function(name) {
		for (var i=0; i<this.length; i++) {
			if (!this[i])
				continue;

			if (this[i].name === name)
				return this[i];
		}

		return null;
	}.bind(files);

	// Find a tab given a file name
	tabs.find = function(name) {
		for (var i=0; i<this.length; i++) {
			if(!this[i])
				continue;

			if (this[i].file.name === name)
				return this[i];
		}

		return null;
	}.bind(tabs);

	var File = (function () {
		var _counter = 0;
		var _tree = $("#editor-tree");
		var _editor = new Editor();

		return function (name, data) {
			this.id = sprintf("editor-file-%d", _counter++);
			this.name = name;
			this.data = data;

			_tree.tree('appendNode', { label: name, file: this});
		};
	})();

	var Tab = (function () {
		var _counter = 0;
		var _tabs = $("#editor-tabs");
		var _editor = new Editor(); // JSLint complains about missing new

		/* Creates a new, unused file name */
		var newName = (function() {
			var _untitled = 0;
			return function () { return sprintf(config.newName, _untitled++); };
		})();

		return function (file) {
			this.id = sprintf("editor-tab-%d", _counter++);
			this.file = file;

			var _label = null;

			var addTab = function() {
				_label = _tabs.find(".ui-tabs-nav").append(
					templates.editor.tab({
						href: "#"+this.id,
						label: this.label
				}));

				_label.disableSelection();
				_tabs.append(templates.editor.container(this.id, this.content));

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
	};

	// Open a file
	this.open = function(file) {
		if (!file)
			return;

		var tab = tabs.find(file.name);
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

	/* Creates new tab with empty file */
	this.newFile = function(name, data) {
		var f = new File(name, data);
		files.push(f);
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
}

