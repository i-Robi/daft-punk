/**
 * @file Dot navigation.
 * @description Based on Codrops' article [Dot Navigation Styles]
 * (http://tympanus.net/codrops/2014/01/21/dot-navigation-styles/).
 * @author Sébastien Robaszkiewicz [sebastien@robaszkiewicz.com]
 */

'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var DotNav = (function () {
  function DotNav() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, DotNav);

    this.callback = options.callback;
    this.nav = options.nav;
    this.selected = options.selected;

    this.init();
  }

  _createClass(DotNav, [{
    key: 'init',
    value: function init() {
      var _this = this;

      var dots = this.nav.querySelectorAll('li');

      dots[this.selected].classList.add('selected');

      var _loop = function (i) {
        var dot = dots[i];

        dot.addEventListener('click', function () {
          if (i !== _this.selected) {
            dots[_this.selected].classList.remove('selected');

            dot.classList.add('selected');
            _this.callback(i);
            _this.selected = i;
          }
        });
      };

      for (var i = 0; i < dots.length; i++) {
        _loop(i);
      }
    }
  }]);

  return DotNav;
})();

module.exports = DotNav;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9qcy9Eb3ROYXYuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQU9BLFlBQVksQ0FBQzs7Ozs7O0lBQ1AsTUFBTTtBQUNDLFdBRFAsTUFBTSxHQUNnQjtRQUFkLE9BQU8seURBQUcsRUFBRTs7MEJBRHBCLE1BQU07O0FBRVIsUUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDO0FBQ2pDLFFBQUksQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQztBQUN2QixRQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7O0FBRWpDLFFBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztHQUNiOztlQVBHLE1BQU07O1dBU04sZ0JBQUc7OztBQUNMLFVBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBRTdDLFVBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQzs7NEJBRXJDLENBQUM7QUFDUixZQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBRXBCLFdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBTTtBQUNsQyxjQUFJLENBQUMsS0FBSyxNQUFLLFFBQVEsRUFBRTtBQUN2QixnQkFBSSxDQUFDLE1BQUssUUFBUSxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQzs7QUFFakQsZUFBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDOUIsa0JBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLGtCQUFLLFFBQVEsR0FBRyxDQUFDLENBQUM7V0FDbkI7U0FDRixDQUFDLENBQUM7OztBQVhMLFdBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2NBQTdCLENBQUM7T0FZVDtLQUNGOzs7U0EzQkcsTUFBTTs7O0FBOEJaLE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDIiwiZmlsZSI6InNyYy9qcy9Eb3ROYXYuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlIERvdCBuYXZpZ2F0aW9uLlxuICogQGRlc2NyaXB0aW9uIEJhc2VkIG9uIENvZHJvcHMnIGFydGljbGUgW0RvdCBOYXZpZ2F0aW9uIFN0eWxlc11cbiAqIChodHRwOi8vdHltcGFudXMubmV0L2NvZHJvcHMvMjAxNC8wMS8yMS9kb3QtbmF2aWdhdGlvbi1zdHlsZXMvKS5cbiAqIEBhdXRob3IgU8OpYmFzdGllbiBSb2Jhc3praWV3aWN6IFtzZWJhc3RpZW5Acm9iYXN6a2lld2ljei5jb21dXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuY2xhc3MgRG90TmF2IHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5jYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgdGhpcy5uYXYgPSBvcHRpb25zLm5hdjtcbiAgICB0aGlzLnNlbGVjdGVkID0gb3B0aW9ucy5zZWxlY3RlZDtcblxuICAgIHRoaXMuaW5pdCgpO1xuICB9XG5cbiAgaW5pdCgpIHtcbiAgICBjb25zdCBkb3RzID0gdGhpcy5uYXYucXVlcnlTZWxlY3RvckFsbCgnbGknKTtcblxuICAgIGRvdHNbdGhpcy5zZWxlY3RlZF0uY2xhc3NMaXN0LmFkZCgnc2VsZWN0ZWQnKTtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG90cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZG90ID0gZG90c1tpXTtcblxuICAgICAgZG90LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICBpZiAoaSAhPT0gdGhpcy5zZWxlY3RlZCkge1xuICAgICAgICAgIGRvdHNbdGhpcy5zZWxlY3RlZF0uY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKTtcblxuICAgICAgICAgIGRvdC5jbGFzc0xpc3QuYWRkKCdzZWxlY3RlZCcpO1xuICAgICAgICAgIHRoaXMuY2FsbGJhY2soaSk7XG4gICAgICAgICAgdGhpcy5zZWxlY3RlZCA9IGk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IERvdE5hdjtcbiJdfQ==