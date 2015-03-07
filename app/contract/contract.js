'use strict';

angular.module('spritzle.contract', ['ngRoute', 'ngAnimate', 'ui.bootstrap'])

    .factory('web3Service', [function() {
        return {
            'getWeb3': function(node){
                if(!node){
                    node = 8080;
                }
                var web3 = require('web3');
                var url = "http://127.0.0.1:" + node + "/";
                web3.setProvider(new web3.providers.HttpSyncProvider(url));
                console.log("connect to Ethereum node at " + url);
                return web3;
            }
        }

    }])

    .factory('oracles', function(){
        return [
            {description: 'NYMEX Spot Brent Crude (Random)', address: '0xdeaf82606e55881d8f34fb48cd9e439fc6d69af6', abi:'price-oracle.abi'},
            {description: 'Bitcoin', address:'0x2d99defea581c64b942daaea4f163efa8da36f55', abi:'bitcoin-price-oracle.abi'}
        ];
    })

    .factory('nameReg', function(){
        return {
            "0xdfad581d0c1ca63a4dad655afe60a43f5e83784f": "Ajeet",
            "0x53a7397af32f6dffaf80e78e751292ebf5d70795": "Patrick"
        };
    })

    .config(['$routeProvider', function($routeProvider) {
        $routeProvider.when('/contract/create/:node', {
            templateUrl: 'contract/create.html',
            controller: 'CreateCtrl'
        })
        .when('/contract/details/:contractAddress/:node', {
            templateUrl: 'contract/details.html',
            controller: 'DetailsCtrl'
        });
    }])
    /*
    .directive('status', [function(){
       return {
           templateUrl: 'contract/status.html',
           restrict: 'E'
       }
    }])

    .controller('StatusCtrl', ['$scope', '$rootScope', '$routeParams', '$log', 'web3Service', 'nameReg', function($scope, $rootScope, $routeParams, $log, web3Service, nameReg){
        $scope.web3 = {};
        $scope.node = $routeParams.node;
        var web3 = web3Service.getWeb3($scope.node);

        // test if web3 is available
        try {
            $scope.web3.available = (web3.eth.coinbase !== "");
        } catch(e) {
            $log.error(e);
            $scope.web3.error = e;
            console.log('error');
        }
        if(typeof nameReg[web3.eth.accounts[0]] !== "undefined"){
            $scope.userName = nameReg[web3.eth.accounts[0]];
        }else{
            $scope.userName = web3.eth.accounts[0];
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
        }else{
            $log.error("web3 is not available");
        }
    }])
*/
    .controller('CreateCtrl', ['$scope', '$routeParams', '$q', '$http', '$location', '$log', '$timeout', 'moment', 'web3Service', 'oracles', 'nameReg', function($scope, $routeParams, $q, $http, $location, $log, $timeout, moment, web3Service, oracles, nameReg) {
        $scope.node = $routeParams.node;
        var web3 = web3Service.getWeb3($scope.node);
        $scope.web3 = {};

        $scope.oracles = oracles;
        $scope.oracle = 0;
        $scope.contractReady = false;
        $scope.contractDeployed = false;

        $scope.contract = {
            'description': 'barrel Brent Crude',
            'amount': 1,
            'fraction': 1,
            'marginPercent': 25,
            'isValid': false
        };
        $scope.timeunits = "seconds";
        $scope.timedelta = 150;

        $scope.expirationTime = moment().add($scope.timedelta, $scope.timeunits);

        if(typeof nameReg[web3.eth.accounts[0]] !== "undefined"){
            $scope.userName = nameReg[web3.eth.accounts[0]];
        }else{
            $scope.userName = web3.eth.accounts[0];
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

        $scope.setContractParams = function(){
            $http.get("abi/custodial-forward.abi").then(function(res){
                console.log("setting parameters");
                var ContractClass = web3.eth.contract(res.data);
                var contract = new ContractClass($scope.contractAddress);

                var expirationDate = $scope.expirationTime.unix();
                var contractedPrice = web3.toWei($scope.contract.contractedPrice, "ether");

                var params = [$scope.contract.amount, expirationDate, contractedPrice, oracles[$scope.oracle].address, $scope.contract.description, $scope.contract.fraction, $scope.contract.marginPercent];
                console.log("params:");
                console.dir(params);
                contract.sendTransaction({gas:300000}).setPrimaryParams($scope.contract.amount, expirationDate, contractedPrice, $scope.contract.description, $scope.contract.fraction, $scope.contract.marginPercent, oracles[$scope.oracle].address);
                $scope.contractReady = true;
                $location.path('/contract/details/' + $scope.contractAddress + '/' + $scope.node);
            });
        }

        web3.eth.filter('chain').watch(function(res){
            $scope.updateStatus();
            updateOracle();
            if($scope.contractAddress){
                if(web3.eth.getData($scope.contractAddress)){
                    $scope.contract.isValid = true;
                    $timeout(function(){
                        $scope.contractDeployed = true;
                    }, 3000);

                }

            }

            if($scope.contractReady){
                //$location.path('/contract/details/' + $scope.contractAddress + '/' + $scope.node);
            }else if($scope.contractDeployed){
                $scope.setContractParams();
            }
        });

        $scope.updateStatus();
        /*
        $scope.$on('newBlock', function(){
           updateOracle();
           if($scope.contractAddress){
               if(web3.eth.getData($scope.contractAddress)){
                   $scope.contract.isValid = true;
                   $scope.contractDeployed = true;
               }

           }

           if($scope.contractReady){
               //$location.path('/contract/details/' + $scope.contractAddress + '/' + $routeParams.node);
           }else if($scope.contractDeployed){
               $scope.setContractParams();
           }
        });
*/
        $scope.createContract = function(){
            $http.get("abi/custodial-forward.sol").then(function(res){
                var compiled = web3.eth.compile.solidity(res.data);
                if(!compiled){
                    $log.error("compilation error!");
                    return;
                }
                var address = web3.eth.sendTransaction({gas:900000, code: compiled});
                if(address){
                    $scope.contractAddress = address;
                    console.log("contract created at " + address);
                }


            });
        }




    }])

    .controller('DetailsCtrl', ['$scope', '$routeParams', '$q', '$http', 'web3Service', 'nameReg', function($scope, $routeParams, $q, $http, web3Service, nameReg) {

        $scope.node = $routeParams.node;
        var web3 = web3Service.getWeb3($scope.node);

        $scope.contract = {};
        $scope.web3 = {};
        $scope.contractAddress = $routeParams.contractAddress;
        var web3contract = $q.defer();

        $http.get('abi/custodial-forward.abi').then(function(res) {
            var ContractClass = web3.eth.contract(res.data);
            web3contract.resolve(new ContractClass($scope.contractAddress));
        });

        if(typeof nameReg[web3.eth.accounts[0]] !== "undefined"){
            $scope.userName = nameReg[web3.eth.accounts[0]];
        }else{
            $scope.userName = web3.eth.accounts[0];
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

        $scope.updateContract = function(){
            web3contract.promise.then(function(contract){
                $scope.contract.amount = contract.call().amount().toNumber();
                $scope.contract.expirationDate = contract.call().expirationDate() * 1000;
                $scope.contract.contractedPrice = web3.fromWei(contract.call().contractedPrice(), "ether").toNumber();
                $scope.contract.underlyingPrice = web3.fromWei(contract.call().getUnderlyingPrice(), "ether").toNumber();
                $scope.contract.settlementPrice = web3.fromWei(contract.call().settlementPrice(), "ether").toNumber();
                $scope.contract.underlyingAssetDescription = contract.call().underlyingAssetDescription();
                $scope.contract.underlyingAssetFraction = contract.call().underlyingAssetFraction().toNumber();
                $scope.contract.marginPercent = contract.call().marginPercent().toNumber();
                $scope.contract.openDate = contract.call().openDate();
                $scope.currentBlockTimestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp * 1000;

                if(contract.call().seller() != "0x0000000000000000000000000000000000000000")
                    if(typeof nameReg[contract.call().seller()] !== "undefined")
                        $scope.contract.seller = nameReg[contract.call().seller()];
                    else
                        $scope.contract.seller = contract.call().seller();
                if(contract.call().owner() != "0x0000000000000000000000000000000000000000")
                    if(typeof nameReg[contract.call().owner()] !== "undefined")
                        $scope.contract.owner = nameReg[contract.call().owner()];
                    else
                        $scope.contract.owner = contract.call().owner();
                if($scope.contract.seller && $scope.contract.owner && ($scope.contract.seller != $scope.contract.owner))
                    if(typeof nameReg[contract.call().owner()] !== "undefined")
                        $scope.contract.buyer = nameReg[contract.call().owner()];
                    else
                        $scope.contract.buyer = contract.call().owner();

                if(contract.call().isSettled() == 1){
                    $scope.contract.isSettled = true;
                    $scope.closeInProgress = false;
                }else{
                    $scope.contract.isSettled = false;
                }

                if($scope.contract.isSettled){
                    $scope.contract.sellerBalance = 0;
                    $scope.contract.buyerBalance = 0;
                } else {
                    $scope.contract.sellerBalance = web3.fromWei(contract.call().sellerBalance(), "ether").toNumber();
                    $scope.contract.buyerBalance = web3.fromWei(contract.call().buyerBalance(), "ether").toNumber();
                }

                $scope.contract.balance = web3.fromWei(web3.eth.getBalance($scope.contractAddress), "ether").toNumber();
                $scope.marginAmount = web3.fromWei(contract.call().computeMarginAmount(), "ether").toNumber();

                if($scope.contract.seller && $scope.contract.buyer){
                    var settlementAmount = contract.call().computeSettlementAmount();
                    $scope.contract.buyerBalanceMtm = contract.call().buyerBalance().plus(settlementAmount);
                    $scope.contract.sellerBalanceMtm = contract.call().sellerBalance().minus(settlementAmount);
                    $scope.contract.buyerPnl = contract.call().buyerBalance().minus($scope.contract.buyerBalanceMtm);
                    $scope.contract.sellerPnl = contract.call().sellerBalance().minus($scope.contract.sellerBalanceMtm);
                    $scope.contract.buyerPnl = web3.fromWei($scope.contract.buyerPnl, "ether").toNumber();
                    $scope.contract.sellerPnl = web3.fromWei($scope.contract.sellerPnl, "ether").toNumber();
                }

                if(web3.eth.getData($scope.contractAddress)){
                    $scope.contract.isValid = true;
                }else{
                    $scope.contract.isValid = false;
                }
                if(contract.call().isAvailable() == 1){
                    $scope.contract.isAvailable = true;
                    $scope.offerInProgress = false;
                }else{
                    $scope.contract.isAvailable = false;
                    $scope.purchaseInProgress = false;
                }
            });
        };

        $scope.getSystemTime = function(){
            return new Date().getTime();
        }

        web3.eth.filter('chain').watch(function(res){
            $scope.updateStatus();
            $scope.updateContract();
        });

        $scope.offerContract = function(){
            $scope.offerInProgress = true;
            web3contract.promise.then(function(contract){
               contract.sendTransaction({gas:200000, value:contract.call().computeMarginAmount()}).offer();
            });
        };

        $scope.buyContract = function(){
            $scope.purchaseInProgress = true;
            web3contract.promise.then(function(contract){
               contract.sendTransaction({gas:200000, value:contract.call().computeMarginAmount()}).buy();
            });
        };

        $scope.closeContract = function(){
            $scope.closeInProgress = true;
            web3contract.promise.then(function(contract){
                contract.sendTransaction({gas:200000}).close();
            });
        }

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
            $scope.updateStatus();
            $scope.updateContract();

        }

        init();

    }]);


