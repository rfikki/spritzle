'use strict';

angular.module('spritzle.contract', ['ngRoute', 'ngAnimate', 'ui.bootstrap'])

    .factory('web3', function() {
        var web3 = require('web3');
        web3.setProvider(new web3.providers.HttpSyncProvider("http://localhost:8080/"));
        return web3;
    })

    .config(['$routeProvider', function($routeProvider) {
        $routeProvider.when('/contract/create', {
            templateUrl: 'contract/create.html',
            controller: 'CreateCtrl'
        })
        .when('/contract/details/:contractAddress', {
            templateUrl: 'contract/details.html',
            controller: 'DetailsCtrl'
        });
    }])

    .controller('StatusCtrl', ['$scope', '$log', 'web3', function($scope, $log, web3){
        $scope.web3 = {};

        // test if web3 is available
        try {
            $scope.web3.available = (web3.eth.coinbase !== "");
        } catch(e) {
            $log.error(e);
            $scope.web3.error = e;
            console.log('error');
        }

        $scope.updateStatus = function(){
            var account = web3.eth.accounts[0];
            $scope.web3.block = web3.eth.blockNumber;
            $scope.web3.balance = web3.fromWei(web3.eth.getBalance(account), "ether").toNumber();
            $scope.web3.timestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp * 1000;
            console.log('updated status. block: ' + web3.eth.blockNumber);
            console.log('scope: ' + $scope.web3.timestamp);
            try{
                $scope.$digest();
            }catch(e){

            }

        };

        var init = function(){
            web3.eth.filter('chain').watch(function(res){
               $scope.updateStatus();
            });
        }
        if($scope.web3.available){
            $scope.updateStatus();
            init();
            console.log(web3.eth.blockNumber);
        }else{
            $log.error("web3 is not available");
        }


    }])

    .controller('CreateCtrl', ['$scope', '$routeParams', '$q', '$http', 'web3', 'moment', function($scope, $routeParams, $q, http, web3, moment) {

        $scope.oracles = [
            {description: 'Bitcoin', address:'0x12ec7131131f65d264f435bdf24f57db263e3b6f'}
        ]
        $scope.oracle = 0;

        $scope.contract = {
            'amount': 1,
            'multiple': 1,
            'fraction': 1
        };
        $scope.timeunits = "minutes";
        $scope.timedelta = 2;

        $scope.expirationTime = moment().add($scope.timedelta, $scope.timeunits);

        $scope.$watch("timedelta", function(value){
            console.log('setting time delta');
            $scope.expirationTime = moment().add(value, $scope.timeunits);
        });


        $scope.setTimeUnits = function(timeunits){
            $scope.timeunits = timeunits;
            $scope.expirationTime = moment().add($scope.timedelta, $scope.timeunits);
        };

        $scope.setOracle = function(oracle){
            $scope.contract.oracle = oracle;
        }

        $scope.timeunitstatus = {
            isopen: false
        };

        $scope.oracletstatus = {
            isopen: false
        };

        $scope.toggleDropdown = function($event) {
            $event.preventDefault();
            $event.stopPropagation();
            $scope.status.isopen = !$scope.status.isopen;
        };


    }])

    .controller('DetailsCtrl', ['$scope', '$routeParams', '$q', '$http', 'web3', function($scope, $routeParams, $q, http, web3) {
        $scope.contract = {};
        $scope.web3 = {};
        $scope.contractAddress = $routeParams.contractAddress;
        $scope.contract = $q.defer();


        $scope.updateContract = function(){

        };

        // test if web3 is available
        try {
            $scope.web3.available = (web3.eth.coinbase !== "");
            $scope.contractExists = (web3.eth.getData($scope.contractAddress) !== "0x0000000000000000000000000000000000000000000000000000000000000000");
        } catch(e) {
            $log.error(e);
            $scope.web3.error = e;
        }

        var init = function(){
            if(!$scope.contractExists){
                $scope.web3.error = {"name": "invalid contract id", "message": "the specified contract " + $scope.contractAddress + " does not exist"};
            }


        }

    }]);


