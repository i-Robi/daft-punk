/**
 * @file Dot navigation.
 * @description Based on Codrops' article [Dot Navigation Styles]
 * (http://tympanus.net/codrops/2014/01/21/dot-navigation-styles/).
 * @author Sébastien Robaszkiewicz [sebastien@robaszkiewicz.com]
 */

'use strict';
class DotNav {
  constructor(options = {}) {
    this.callback = options.callback;
    this.nav = options.nav;
    this.selected = options.selected;

    this.init();
  }

  init() {
    const dots = this.nav.querySelectorAll('li');

    dots[this.selected].classList.add('selected');

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];

      dot.addEventListener('click', () => {
        if (i !== this.selected) {
          dots[this.selected].classList.remove('selected');

          dot.classList.add('selected');
          this.callback(i);
          this.selected = i;
        }
      });
    }
  }
}

module.exports = DotNav;
