/*jslint browser: true smarttabs: true */ /*global config $ jQuery sprintf templates CodeMirror App settings */
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
	tabs.findByFile = function (file) {
		for (var i=0; i<this.length; i++) {
			if (!this[i])
				continue;

			if (this[i].file.name === file.name)
				return this[i];
		}
	}.bind(tabs);

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

	tabs.clearErrors = function() {
		for (var i=0; i<this.length; i++) {
			if (this[i])
				this[i].clear();
		}
	}.bind(tabs);

	files.remove = function(file) {
		for (var i=0; i<this.length; i++) {
			if (!this[i] || this[i].name !== file.name)
				continue;

			delete this[i];

			return;
		}
	}.bind(files);

	/* Creates a new, unused file name */
	var newName = (function() {
		var _untitled = 0;
		return function () { return sprintf(config.newName, _untitled++); };
	})();


	var File = (function () {
		var _counter = 0;
		var _tree = $("#editor-tree > div");

		var addToTree = function(file) {
			var label = file.name;
			var parentNode;
			var dirs = file.name.split("/");
			var toOpen = [];
			if (dirs.length > 1) {
				label = dirs.pop();

				for (var i=0; i<dirs.length; i++) {
					var node = _tree.tree('getNodeById', dirs[i]);
					if (!node) {
						node = _tree.tree('appendNode',
						                  { label: dirs[i], id: dirs[i]},
						                  parentNode);
					}

					toOpen.push(node);
					parentNode = node;
				}
			}

			_tree.tree('appendNode', { label: label, file: file, id: file.name}, parentNode);
			for (var j=0; j<toOpen.length; j++)
				_tree.tree('openNode', toOpen[j], false);

			// Hack time!
			var content = JSON.parse(_tree.tree('toJson'));
			content = (function(tree) {
				var xor = function(a,b) { return !a != !b; };
				var comp = function(a,b) {
					// Keep directories above regular files
					if (xor(a.children, b.children))
						return a.children ? -1 : 1;
					else
						return a.name > b.name ? 1 : (a.name === b.name ? 0 : -1);
				};

				var sorter = function(level) {
					level = level.sort(comp);
					for (var i=0; i<level.length; i++) {
						if (level[i].children)
							level[i].children = sorter(level[i].children);
					}

					return level;
				};

				return sorter(tree);
			})(content);

			_tree.tree('loadData', content);

		};

		return function (name, data) {
			this.id = sprintf("editor-file-%d", _counter++);
			this.name = name;
			this.data = data;

			// Remove leading "/" from file name
			if (/^\//.test(this.name))
				this.name = this.name.substring(1);

			this.toJSON = function () {
				return { name: this.name, data: this.data };
			};

			addToTree(this);
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
			var _errorLine = null;

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
					keyMap: settings["editor-mode"],
					lineNumbers: true,
					matchBrackets: true,
					onKeyEvent: function(cm, event) {
						// Ctrl+Return
						if (event.type === "keydown" && event.ctrlKey &&
								event.which === 13) {
							_editor.compile();
							event.stop();
						}
					}
				});

				_codemirror.on("change", _editor.autosave);

				_codemirrorDiv.find("> div")
					.addClass("ui-corner-all ui-widget ui-widget-container");

				tabs.push(this);
				_editor.refresh();
			}.bind(this);

			var index = function() {
				return _label.find('li a[href="#'+this.id+'"]').parent().index();
			}.bind(this);

			var on_editorModeSetting = function(setting) {
				if (setting && setting.key === "editor-mode")
					this.reloadEditor();
			}.bind(this);

			this.open = function(line, column) {
				_tabs.tabs("select", index());
				_codemirror.focus();

				if (line > -1 && column > -1) {
					_codemirror.scrollIntoView({line: line, ch: column});
					_errorLine = _codemirror.addLineClass(line-1, "background", "error");
					_codemirror.doc.setCursor(line-1, column-1);
				}
			};

			this.clear = function() {
				if (_errorLine) {
					_codemirror.removeLineClass(_errorLine, "background", "error");
					_errorLine = null;
				}
			};

			/* Reloads the editor embedded in the tab */
			this.reloadEditor = function() {
				this.flush();

				_codemirrorDiv.empty();
				_codemirror = new CodeMirror(_codemirrorDiv[0], {
					value: this.file.data,
					keyMap: settings["editor-mode"],
					lineNumbers: true,
					matchBrackets: true
				});
				_codemirror.refresh();
			};

			this.refresh = function() {
				_codemirror.refresh();
			};

			/* Flush content of CodeMirror instance to file object */
			this.flush = function() {
				this.file.data = _codemirror.getValue();
			};

			this.destroy = function() {
				this.flush();
				$('li[aria-controls="'+this.id+'"]').remove();
				$("#"+this.id).remove();

				// Always have one tab open
				if (tabs.empty()) {
					var f = _editor.newFile();
					Editor().open(f);
				}

				App().messages.unsubscribe("settings-changed", on_editorModeSetting);
				_editor.refresh();
			};

			if (this.file) {
				this.label = file.name;
				this.content = file.data;
			} else {
				this.label = newName();
				this.content = "";
			}

			addTab();
			App().messages.subscribe("settings-changed", on_editorModeSetting);
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

	var _query_cb = null;
	var queryFilename = function(cb, title, nameStr) {
		title = title || "New File";
		_query_cb = cb;
		var dialog = $("#editor-dialog-newfile");

		// If a name string is given, use that as starting file name
		if (nameStr) {
			// Selection start and end positions
			var start = nameStr.lastIndexOf("/");
			var end = nameStr.lastIndexOf(".");
			start = start < 0 ? 0 : start + 1; // Don't include "/"
			end = end > 0 && end > start ? end : nameStr.length;

			var input = dialog.find("#editor-dialog-newfile-name")[0];
			input.value = nameStr;
			input.selectionStart = start;
			input.selectionEnd = end;
		}

		dialog.dialog("option", "title", title)
			.dialog("open");
	};

	var setPosition = function(file, line, column) {
		var tab = tabs.findByFile(files.findByName(file));

		if (tab) {
			tab.open(line, column);
		}
		else {
			tab = this.open(file);
			tab.open(line, column);
		}
	}.bind(this);

	this.initGUI = function() {
		var tabsDiv = $("#editor-tabs");
		var tree = $("#editor-tree > div");
		var treeMenu = $("#editor-tree #editor-tree-menu");

		if (!tabsDiv.size() || !tree.size() || !treeMenu.size())
			return;

		tabsDiv.tabs({
			activate: function(event, ui) {
				var tabId = $(ui.newTab).children("a").attr("href").substring(1);
				var tab = tabs.findById(tabId);
				tab.refresh();
			}
		});

		treeMenu.menu().hide();

		tree.tree({
			data: {},
			autoOpen: true,
			saveState: true,
			slide: false
		});
		tree.disableSelection();

		// Clicks on file icon (a :before) never reaches 'tree.click' event
		tree.click(function (event) {
			if (event.target.tagName === "DIV") {
				$(event.target).children("span").click();
			}
		});

		tree.bind('tree.click', function(event) {
			var node = event.node;
			if (node.file) {
				// Since the tree is sorted in such a hacky way, this must be done
				var file = files.findByName(node.file.name);
				Editor().open(file);
			}
			else
				tree.tree("toggle", node, false);
		});

		tree.bind('tree.contextmenu', function (event) {
			var node = event.node;

			if (!node.file)
				return;

			treeMenu.show()
				.position({
					my: "left top",
					at: "left bottom",
					of: event.click_event
			});

			$(document).one("click", function() {
				treeMenu.menu("collapseAll", null, true);
				treeMenu.hide();
			});

			treeMenu.one("click", function (event) {
				var item = $(event.target).parents("li").first();
				var action = item[0].getAttribute("data-action");

				if (action && node.file) {
					switch(action) {
						case "delete":
							Editor().removeFile(node.file);
							break;
						case "rename":
							Editor().renameFile(node.file);
							break;
						case "copy":
							Editor().copyFile(node.file);
							break;
					}
				}

				treeMenu.hide();
			});
		});


		$("#editor-button-compile")
			.button({
				text: true,
				icons: { primary: "ui-icon-wrench"}
			})
			.click(function() {
				Editor().compile();
			});

		if (config.debug) {
			var dump = $("<button>Dump</button>");
			dump.insertAfter($("#editor-button-compile"));
			dump.button({
				text: true,
				icons: { primary: "ui-icon-lightbulb"}
			})
			.click((function() {
				var pass = 0;
				return function() {
					if (App().program)
						App().program.debug(pass++);
				};
			})());
		}

		$("#editor-button-newfile")
			.button({
				text: true,
				icons: { primary: "ui-icon-plus"}
			})
			.click(function() {
				var e = Editor();
				queryFilename(function(name) {
					e.open(e.newFile(name));
				}, "New File");
			});

		$("#editor-button-save")
			.button({
				text: true,
				icons: { primary: "ui-icon-disk"}
			})
			.click(function() {
				Editor().save();
			});


		$("#editor-button-settings")
			.button({
				text: true,
				icons: { primary: "ui-icon-gear", secondary: "ui-icon-triangle-1-s" }
			})
			.click(function() {
				var menu = $(this).next().show().position({
					my: "left top",
					at: "left bottom",
					of: this
				});

				$(document).one("click", function() {
					menu.menu("collapseAll", null, true);
					menu.hide();
				});

				menu.one("click", function(event) {
					var item = $(event.target).parents("li").first();
					var submenu = item[0].getAttribute("data-submenu");
					if (submenu)
						return; // Open submenu

					var key = item.parents('[data-submenu]').last();
					var value;
					if (key.length) {
						key = key[0].getAttribute("data-submenu");
						value = item[0].getAttribute("data-mode");
						settings.set(key, value);

						menu.menu("collapseAll", null, true);
						menu.hide();
						return;
					}

					key = item[0].getAttribute("data-setting");
					if (key.length) {
						switch (key) {
							case "autosave":
								value = settings["auto-save"];
								settings.set("auto-save", !value);
								break;
							case "fetch":
								Editor().fetch(config.files.fetch);
								break;
							case "about":
								Editor().about();
						}
						menu.hide();
						return;
					}

					menu.hide();
				});

				return false;
			});

		var settingsMenu = $("#editor-button-settings").next().menu().hide();
		var refreshEditorMode = function() {
			if (settings["editor-mode"] === this.getAttribute("data-mode")) {
				$(this).find("span")
					.addClass("ui-icon-radio-on")
					.removeClass("ui-icon-radio-off");
			}
			else {
				$(this).find("span")
					.addClass("ui-icon-radio-off")
					.removeClass("ui-icon-radio-on");
			}
		};

		var refreshAutosave = function(element) {
			var span = $(element).find("span");
			if(settings["auto-save"])
				span.addClass("ui-icon-check ui-icon");
			else
				span.removeClass("ui-icon-check ui-icon");
		};

		settingsMenu.find('[data-submenu="editor-mode"] li').each(refreshEditorMode);
		refreshAutosave(settingsMenu.find('[data-setting="autosave"]'));
		App().messages.subscribe("settings-changed", function(setting) {
			if (!setting.key)
				return;

			switch (setting.key) {
				case "editor-mode":
					settingsMenu.find('[data-submenu="editor-mode"] li')
						.each(refreshEditorMode);
					break;
				case "auto-save":
					refreshAutosave(settingsMenu.find('[data-setting="autosave"]'));
					if (settings["auto-save"])
						Editor().save();
					break;
			}
		});


		var dialog = $("#editor-dialog-newfile")
			.dialog({
				autoOpen: false,
				modal: true,
				buttons: {
					Ok: function() {
						var name = $(this).find("#editor-dialog-newfile-name")[0].value;
						_query_cb(name);
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

		dialog.find("form").submit(function (event) {
			var name = dialog.find("#editor-dialog-newfile-name")[0].value;
			_query_cb(name);
			dialog.dialog("close");
			event.preventDefault();
		});

		var about = $("#about-dialog").dialog({
				autoOpen: false,
				modal: true,
				minWidth: 350
		});

		// Build attribution list
		var attribution = about.find("#attribution");
		for (var url in config.images) {
			if (config.images[url])
				attribution.append($(templates.attribution(config.images[url])));
		}

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

		if (typeof(file) === "string")
			return this.open(files.findByName(file));

		settings.set("last-file", file.name);
		var tab = tabs.findByFile(file);
		if (tab) {
			tab.open();
			return tab;
		}

		tab = new Tab(file);
		tab.open();

		return tab;
	};

	this.removeFile = function(file) {
		if (typeof(file) === "string")
			file = files.findByName(file);

		if (!file)
			return;

		var _tree = $("#editor-tree > div");
		var treeNode = _tree.tree('getNodeById', file.name);
		if (treeNode) {
			var parent = treeNode.parent;
			_tree.tree('removeNode', treeNode);
			if (parent.children.length === 0) {
				_tree.tree('removeNode', parent);
			}
		}

		var tab = tabs.findByFile(file);
		if (tab)
			tabs.remove(tab.id);

		files.remove(file);

		this.autosave();
	}.bind(this);

	this.copyFile = function(file) {
		queryFilename(function(name) {
			Editor().newFile(name, file.data);
		}, null, file.name);
	};

	this.renameFile = function(file) {
		queryFilename(function(name) {
			Editor().newFile(name, file.data);
			Editor().removeFile(file);
		}, "Rename File", file.name);
	};

	this.save = function() {
		this.flush();

		if (window.localStorage) {
			var fs = {};
			for (var i=0; i<files.length; i++) {
				if (!files[i])
					continue;

				fs[files[i].name] = files[i].data;
			}

			window.localStorage["files"] = JSON.stringify(fs);
		}
	}.bind(this);

	this.autosave = (function() {
		var timer = null;
		return function() {
			if (!settings["auto-save"])
				return;

			clearTimeout(timer);
			setTimeout(Editor().save, config.autosaveDelay);
		};
	})();

	this.exists = function(fileName) {
		for (var i=0; i<files.length; i++) {
			if (files[i] && files[i].name === fileName)
				return true;
		}

		return false;
	};

	this.refresh = function() {
		$("#editor-tabs").tabs("refresh");
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

		if (name === config.files.defaultFile)
			this.open(f);

		return f;
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
			if (this.exists(file))
				break;

			jQuery.ajax(config.files.root + file, {
				dataType: 'text',
				success: this.newFile.bind(this, file)
			});
			break;

		}
	};

	/* Upload open files, and their imported files to compiler */
	this.compile = function() {
		this.flush();
		tabs.clearErrors();
		App().error.clear();

		function toArray(obj) {
			var arr = [];

			for (var o in obj) {
				if (obj[o])
					arr.push(obj[o]);
			}

			return arr;
		}

		function imports(file) {
			var re = /^import\s+\"(.*)\"/gm;
			var files = [];
			var match = null;

			while (match = re.exec(file.data)) {
				files.push(match[1]);
			}

			return files;
		}

		function additional(fs) {
			var dirty = false;

			for (var f in fs) {
				var imported = imports(fs[f]).map(files.findByName);
				for (var j=0; j<imported.length; j++) {
					if (imported[j] && !(imported[j].name in fs)) {
						fs[imported[j].name] = imported[j];
						dirty = true;
					}
				}
			}

			return dirty ? additional(fs) : fs;
		}

		var fs = {};

		for (var i=0; i<tabs.length; i++) {
			if (!tabs[i])
				continue;

			fs[tabs[i].file.name] = tabs[i].file;
		}

		additional(fs);

		var shaders = { files: toArray(fs).map(function(f) { return f.toJSON(); }) };

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
				App().error.post(sprintf("There was an error while communicating with the compiler: %s", err.responseText));
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

	this.about = function() {
		$("#about-dialog").dialog("open");
	};

	// Initialize
	(function() {
		this.initGUI();

		if (window.localStorage) {
			if (window.localStorage["files"]) {
				var fs = JSON.parse(window.localStorage["files"]);
				for (var f in fs) {
					this.newFile(f, fs[f]);
					if (f === settings["last-file"]) {
						this.open(f);
					}
				}
			}
			else {
				this.fetch(config.files.fetch);
			}
		}
		else {
			App().error.postWarning("localStorage not supported by your browser, files won't be saved!");
			this.fetch(config.files.fetch);
		}
	}.bind(this))();
}

