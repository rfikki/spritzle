'use strict';

angular.module('spritzle.contract', ['ngRoute', 'ngAnimate', 'ui.bootstrap'])

    .factory('web3', function() {
        var web3 = require('web3');
        web3.setProvider(new web3.providers.HttpSyncProvider("http://127.0.0.1:8080/"));
        return web3;
    })

    .factory('oracles', function(){
        return [
            {description: 'Random', address: '0x82c598d55c6cc276d4a5b29cd82d5dec3309818d', abi:'price-oracle.abi'},
            {description: 'Bitcoin', address:'0x2d99defea581c64b942daaea4f163efa8da36f55', abi:'bitcoin-price-oracle.abi'}
        ];
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

    .controller('StatusCtrl', ['$scope', '$rootScope', '$log', 'web3', function($scope, $rootScope, $log, web3){
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
               $rootScope.$broadcast('newBlock');
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

    .controller('CreateCtrl', ['$scope', '$routeParams', '$q', '$http', '$location', '$log', 'moment', 'web3', 'oracles', function($scope, $routeParams, $q, $http, $location, $log, moment, web3, oracles) {

        $scope.oracles = oracles;
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
            $scope.expirationTime = moment().add(value, $scope.timeunits);
        });


        $scope.setTimeUnits = function(timeunits){
            $scope.timeunits = timeunits;
            $scope.expirationTime = moment().add($scope.timedelta, $scope.timeunits);
        };

        var updateOracle = function(){
            $http.get("abi/" + $scope.oracles[$scope.oracle].abi).then(function(res){
                var OracleContractClass = web3.eth.contract(res.data);
                var oracleContract = new OracleContractClass($scope.oracles[$scope.oracle].address);
                $scope.contract.contractedPrice = web3.fromWei(oracleContract.call().getPrice(), "ether").toNumber();
                console.log('oracle getPrice:' + oracleContract.call().getPrice());
            });
        }

        $scope.setOracle = function(oracle){
            $scope.contract.oracle = oracle;
            updateOracle();
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

        updateOracle();

        $scope.$on('newBlock', function(){
            console.log("new block detected");
           updateOracle();
           if($scope.contractAddress){
               $location.path('/contract/details/' + $scope.contractAddress);
           }
        });

        $scope.createContract = function(){
            $http.get("abi/custodial-forward.sol").then(function(res){
                var compiled = web3.eth.compile.solidity(res.data);
                if(!compiled){
                    $log.error("compilation error!");
                    return;
                }
                var address = web3.eth.sendTransaction({code: compiled});
                if(address){
                    $scope.contractAddress = address;
                    console.log("contract created at " + address);
                }


            });
        }




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

        init();

    }]);


