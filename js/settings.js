/*jslint smarttabs:true laxcomma: true*/

window.settings = (function() {
	var s = {
		  "editor-mode": "default"
		, "auto-save": true
		, "last-file": config.files.defaultFile
	};

	if (window.localStorage) {
		if (window.localStorage["settings"])
			s = JSON.parse(window.localStorage["settings"]);

		s.set = function(key, value) {
			if (this[key] && this[key] === value)
				return;

			this[key] = value;
			App().messages.post("settings-changed", { key: key, value: value });
			window.localStorage["settings"] = JSON.stringify(this);
		};

		return s;
	}
	else {

		s.set = function(key, value) {
			if (this[key] && this[key] === value)
				return;

			this[key] = value;
			App().messages.post("settings-changed", { key: key, value: value });
		};

		return s;
	}
})();

