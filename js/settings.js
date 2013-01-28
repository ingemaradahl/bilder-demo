/*jslint smarttabs:true laxcomma: true*/
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

