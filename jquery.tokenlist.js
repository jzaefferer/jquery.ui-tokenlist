/*!
 * jQuery Token List Plugin
 *
 * Copyright 2010 Jörn Zaefferer
 * Dual licensed under the MIT and GPL licenses.
 * 
 * Based on work by Mark Gibson (http://github.com/jollytoad/jquery.ui-tokenlist)
 *
 * Depends:
 *  jquery.ui.widget.js
 *  jquery.ui.autocomplete.js
 * Optional:
 *  jquery.ui.sortable.js (which depends on jquery.ui.mouse.js)
 */
(function($) {

$.widget('ui.tokenlist', {
	
	options: {
		items: [],
		split: /\s*,\s*/,
		join: ', ',
		removeTip: "Remove Item",
		duplicates: false,
		validate: false // May be false, an array of allowed values, or a validation function
	},

	_create: function() {
		var self = this, key = $.ui.keyCode;

		this.element
			// Hide the original field
			.hide()
			// Update our list if the original field is changed
			.bind('change.' + this.widgetName, function() {
				self.value(self.element.val(), true);
			});

		// Generate a list element to replace the original field
		this.tokenlist =
			$('<ul/>')
				.insertAfter(this.element)
				// Allow the widget to also be accessed via the generated element
				.data(this.widgetName, this);

		this.tokenlist
			.addClass(this.widgetBaseClass + ' ui-widget ui-widget-content ui-helper-clearfix')
			.bind('keydown.' + this.widgetName, function(ev) {
				var focus, disabled = self._getData('disabled');

				switch (ev.keyCode) {
				case key.LEFT:
				case key.UP:
				case key.BACKSPACE:
					focus = $(ev.target).closest('li').prev('li');
					break;
				case key.RIGHT:
				case key.DOWN:
				case key.DELETE:
					focus = $(ev.target).closest('li').next('li.'+self.widgetBaseClass+'-item');
					if (!focus.length && !disabled) {
						focus = self.inputElem;
					}
					break;
				case key.HOME:
				case key.PAGE_UP:
					focus = $(ev.target).closest('ul').find('>li:first');
					break;
				case key.END:
				case key.PAGE_DOWN:
					focus = self.inputElem;
					break;
				}

				switch (ev.keyCode) {
				case key.DELETE:
				case key.BACKSPACE:
					if (disabled) {
						focus = undefined;
					} else {
						self._removeItem(ev.target);
					}
					break;
				}

				if (focus && focus.length) {
					focus[0].focus();
					ev.stopPropagation();
					ev.preventDefault();
				}
			})

			// Delete the item if the button is clicked
			.bind('click.' + this.widgetName, function(ev) {
				if (!self._getData('disabled')) {
					if ($(ev.target).is('.'+self.widgetBaseClass+'-remove')) {
						self._removeItem(ev.target);
					}
					if (this === ev.target) {
						self.inputElem[0].focus();
					}
				}
			});
		
		if ($.fn.sortable) {
			this.tokenlist.sortable({
				stop: function() {
					// update items based on list values
					self.options.items = self.tokenlist.find(".ui-tokenlist-label").map(function() { return $(this).text(); }).get();
					self._change();
				}
			});
		}

		this.inputElem =
			$('<input type="text"/>')
				.bind('keydown.' + this.widgetName, function(ev) {
					if (ev.keyCode === key.LEFT) {
						// If caret is at the far-left of the field, move focus to the last item
						var caret;
						if (this.selectionEnd !== undefined) {
							caret = this.selectionEnd;
						}
						if (caret === 0) {
							$(this).closest('li').prev('li').each(function() { this.focus(); });
							ev.preventDefault();
						}
					}
					ev.stopPropagation();
				})
				.bind('change.' + this.widgetName, function() {
					if (self.add($(this).val()).length) {
						$(this).val('');
					}
				}).autocomplete({
					source: this.options.validate,
					delay: 0,
					select: function() {
						setTimeout(function() {
							self.inputElem.trigger("change.tokenlist");
						}, 13);
					}
				});

		// Add the new item input field
		$('<li/>')
			.appendTo(this.tokenlist)
			.addClass(this.widgetBaseClass+'-input')
			.append(this.inputElem);

		this.value(this.element.val());
		
		if (this.element[0].disabled) {
			this.disable();
		}
	},

	_setData: function(key, value) {
		$.widget.prototype._setData.apply(this, arguments);

		if (key === 'disabled') {
			this.inputElem[0].disabled = value;
		}
	},

	input: function() {
		return $(this.inputElem);
	},

	items: function() {
		return this._getData('items');
	},

	empty: function() {
		// Remove all existing items
		$('> li.'+this.widgetBaseClass+'-item', this.tokenlist).remove();
		this.options.items = [];
		return this;
	},

	value: function(newValue, noChange) {
		var value = this._stringify(this.items());

		if (arguments.length > 0) {
			var newItems = this._parse(newValue),
				newValue = this._stringify(newItems);

			if (newValue !== value) {
				this.empty().add(newItems, noChange);
				value = newValue;
			}
		}

		return value;
	},

	add: function(newItems, noChange) {
		var items = this.items(),
			unique = !this._getData('duplicates'),
			validate = this._getData('validate'),
			added = [],
			self = this;

		if (!$.isArray(newItems)) {
			newItems = [newItems];
		}

		$.each(newItems, function(i, item) {
			// Discard duplicate items if duplicates are not allowed
			if (unique && $.inArray(item, items) >= 0) { return; }

			// Validate the item
			if (validate) {
				if ($.isArray(validate)) {
					if ($.inArray(item, validate) < 0) { return; }
				} else if ($.isFunction(validate)) {
					if (!validate.call(self, item)) { return; }
				}
			}

			added.push(item);
			items.push(item);
			self._addItemElem(item);
		});

		if (added.length && !noChange) {
			this._change();
		}

		return added;
	},

	_addItemElem: function(token) {
		var input = $('.'+this.widgetBaseClass+'-input', this.tokenlist),
			label =
				$('<span/>')
					.addClass(this.widgetBaseClass+'-label')
					.text(token),
			button =
				$('<span>x</span>')
					.addClass(this.widgetBaseClass+'-remove ui-icon ui-icon-close')
					.attr('alt', this._getData('removeTip'));

		return $('<li/>')
			.insertBefore(input)
			.addClass(this.widgetBaseClass+'-item ui-state-default ui-corner-all')
			.attr('tabindex','-1')
			.append(label)
			.append(button)

			// Apply/remove style for a focused item
			.bind('focus.' + this.widgetName, function() { $(this).addClass('ui-state-focus'); })
			.bind('blur.' + this.widgetName, function() { $(this).removeClass('ui-state-focus'); });

			// Fix focusing in IE when clicking within the item
//			.bind('click', function() { this.focus(); });
	},

	_removeItem: function(target) {
		var item = $(target).closest('li');
		this.items().splice($(item).prevAll('li').length, 1);
		item.remove();
		this._change();
	},

	_parse: function(value) {
		return (value || '').split(this._getData('split'));
	},

	_stringify: function(items) {
		return items.join(this._getData('join'));
	},

	_change: function() {
		this.element.val(this._stringify(this.items()));
		this._trigger('change');
	},
	
	_getData: function(data) {
		return this.options[data];
	}
});

})(jQuery);

