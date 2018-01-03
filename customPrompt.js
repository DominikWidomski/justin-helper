// Basically copying a lot of this approach
// didn't get the docs, if there are any
// and even this is outdated, v3 vs v4 of inquirer etc
// https://github.com/mokkabonna/inquirer-autocomplete-prompt/blob/a09e785bbf357c305c07d73a3a63ff8966cf5b78/index.js

var util = require('util');
var Base = require('inquirer/lib/prompts/base');
var Choices = require('inquirer/lib/objects/choices');
var observe = require('inquirer/lib/utils/events');
var utils = require('inquirer/lib/utils/readline');
var Paginator = require('inquirer/lib/utils/paginator');

class CustomPrompt extends Base {
  constructor(...args) {
    super(...args);

    this.focus = 0;
  }

  _run(cb) {
    var self = this;
    self.done = cb;

    // if (self.rl.history instanceof Array) {
    //   self.rl.history = [];
    // }

    var events = observe(self.rl);

    // events.line.takeWhile(dontHaveAnswer).forEach(self.onSubmit.bind(this));
    events.keypress.takeWhile(dontHaveAnswer).forEach(self.onKeypress.bind(this));

    function dontHaveAnswer() {
      return !self.answer;
    }

    this.render();

    return this;
  };

  onKeypress(e) {
    var len;
    var keyName = (e.key && e.key.name) || undefined;

    if (keyName === 'left') {
      this.focus = Math.max(0, this.focus - 1);
    } else if (keyName === 'right') {
      this.focus = Math.min(10, this.focus + 1);
    }

    this.render();
  }

  render() {
    this.screen.render("*".repeat(this.focus));
    // console.log(this.screen);
  };
}
util.inherits(CustomPrompt, Base);

module.exports = CustomPrompt;