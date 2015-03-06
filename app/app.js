'use strict';

// Declare app level module which depends on views, and components
angular.module('spritzle', [
  'ngRoute',
    'ngAnimate',
    'angularMoment',
  'spritzle.contract',
  'spritzle.view1',
  'spritzle.view2',
  'spritzle.version'
]).
config(['$routeProvider', function($routeProvider) {
  $routeProvider.otherwise({redirectTo: '/view1'});
}]);
