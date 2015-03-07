'use strict';

angular.module('spritzle.contract', ['ngRoute', 'ngAnimate', 'ui.bootstrap'])

    .factory('web3', function() {
        var web3 = require('web3');
        web3.setProvider(new web3.providers.HttpSyncProvider("http://127.0.0.1:8080/"));
        return web3;
    })

    .factory('oracles', function(){
        return [
            {description: 'Random', address: '0x2f67e0e8aba776588c3b04695e4bb9516b05dda1', abi:'price-oracle.abi'},
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
        $scope.contractReady = false;

        $scope.contract = {
            'amount': 1,
            'multiple': 1,
            'fraction': 1,
            'marginPercent': 15
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
               console.log("getting ABI");
               $http.get("abi/custodial-forward.abi").then(function(res){
                   console.log("setting parameters");
                   var ContractClass = web3.eth.contract(res.data);
                   var contract = new ContractClass($scope.contractAddress);
                   var expirationDate = $scope.expriationTime / 1000;
                   var contractedPrice = web3.toWei($scope.contract.contractedPrice, "ether");
                   contract.setParameters($scope.contract.amount, expirationDate, contractedPrice, oracles[$scope.oracle].address, $scope.contract.description, $scope.contract.units, $scope.contract.fraction, $scope.contract.multiple, $scope.contract.marginPercent);
                   $scope.contractReady = true;
               });
           }

           if($scope.contractReady){
               console.log("redirecting to contract page");
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
                var address = web3.eth.sendTransaction({code: compiled, gas:300000});
                if(address){
                    $scope.contractAddress = address;
                    console.log("contract created at " + address);
                }


            });
        }




    }])

    .controller('DetailsCtrl', ['$scope', '$routeParams', '$q', '$http', 'web3', function($scope, $routeParams, $q, $http, web3) {
        $scope.contract = {};
        $scope.web3 = {};
        $scope.contractAddress = $routeParams.contractAddress;
        var web3contract = $q.defer();

        $http.get('abi/custodial-forward.abi').then(function(res) {
            var ContractClass = web3.eth.contract(res.data);
            web3contract.resolve(new ContractClass($scope.contractAddress));
        });

        $scope.updateContract = function(){
            web3contract.promise.then(function(contract){
                $scope.contract.amount = contract.call().amount();
                $scope.contract.expirationDate = contract.call().expirationDate() * 1000;
                $scope.contract.contractedPrice = contract.call().contractedPrice();
                $scope.contract.underlyingPrice = contract.call().getUnderlyingPrice();
                $scope.contract.underlyingAssetDescription = contract.call().underlyingAssetDescription();
                $scope.contract.underlyingAssetUnitDescription = contract.call().underlyingAssetUnitDescription();
                $scope.contract.underlyingAssetFraction = contract.call().underlyingAssetFraction();
                $scope.contract.underlyingAssetMultiple = contract.call().underlyingAssetMultiple();
                $scope.contract.marginPercent = contract.call().marginPercent();
            });
        };

        $scope.$on("newBlock", function(){
            $scope.updateContract();
        });

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


