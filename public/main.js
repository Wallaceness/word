'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

window.app = angular.module('FullstackGeneratedApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate', 'ngTouch']);

app.config(function ($urlRouterProvider, $locationProvider) {
    // This turns off hashbang urls (/#about) and changes it to something normal (/about)
    $locationProvider.html5Mode(true);
    // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
    $urlRouterProvider.otherwise('/');
    // Trigger page refresh when accessing an OAuth route
    $urlRouterProvider.when('/auth/:provider', function () {
        window.location.reload();
    });
});

// This app.run is for listening to errors broadcasted by ui-router, usually originating from resolves
app.run(function ($rootScope) {
    $rootScope.$on('$stateChangeError', function (event, toState, toParams, fromState, fromParams, thrownError) {
        console.info('The following error was thrown by ui-router while transitioning to state "' + toState.name + '". The origin of this error is probably a resolve function:');
        console.error(thrownError);
    });
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {

    // The given state requires an authenticated user.
    var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
        return state.data && state.data.authenticate;
    };

    // $stateChangeStart is an event fired
    // whenever the process of changing a state begins.
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {

        if (!destinationStateRequiresAuth(toState)) {
            // The destination state does not require authentication
            // Short circuit with return.
            return;
        }

        if (AuthService.isAuthenticated()) {
            // The user is authenticated.
            // Short circuit with return.
            return;
        }

        // Cancel navigating to new state.
        event.preventDefault();

        AuthService.getLoggedInUser().then(function (user) {
            // If a user is retrieved, then renavigate to the destination
            // (the second time, AuthService.isAuthenticated() will work)
            // otherwise, if no user is logged in, go to "login" state.
            if (user) {
                $state.go(toState.name, toParams);
            } else {
                $state.go('login');
            }
        });
    });
});

(function () {

    'use strict';

    // Hope you didn't forget Angular! Duh-doy.

    if (!window.angular) throw new Error('I can\'t find Angular!');

    var app = angular.module('fsaPreBuilt', []);

    app.factory('Socket', function () {
        if (!window.io) throw new Error('socket.io not found!');
        return window.io(window.location.origin);
    });

    // AUTH_EVENTS is used throughout our app to
    // broadcast and listen from and to the $rootScope
    // for important events about authentication flow.
    app.constant('AUTH_EVENTS', {
        loginSuccess: 'auth-login-success',
        loginFailed: 'auth-login-failed',
        logoutSuccess: 'auth-logout-success',
        sessionTimeout: 'auth-session-timeout',
        notAuthenticated: 'auth-not-authenticated',
        notAuthorized: 'auth-not-authorized'
    });

    app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
        var statusDict = {
            401: AUTH_EVENTS.notAuthenticated,
            403: AUTH_EVENTS.notAuthorized,
            419: AUTH_EVENTS.sessionTimeout,
            440: AUTH_EVENTS.sessionTimeout
        };
        return {
            responseError: function responseError(response) {
                $rootScope.$broadcast(statusDict[response.status], response);
                return $q.reject(response);
            }
        };
    });

    app.config(function ($httpProvider) {
        $httpProvider.interceptors.push(['$injector', function ($injector) {
            return $injector.get('AuthInterceptor');
        }]);
    });

    app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {

        function onSuccessfulLogin(response) {
            var user = response.data.user;
            Session.create(user);
            $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
            return user;
        }

        // Uses the session factory to see if an
        // authenticated user is currently registered.
        this.isAuthenticated = function () {
            return !!Session.user;
        };

        this.getLoggedInUser = function (fromServer) {

            // If an authenticated session exists, we
            // return the user attached to that session
            // with a promise. This ensures that we can
            // always interface with this method asynchronously.

            // Optionally, if true is given as the fromServer parameter,
            // then this cached value will not be used.

            if (this.isAuthenticated() && fromServer !== true) {
                return $q.when(Session.user);
            }

            // Make request GET /session.
            // If it returns a user, call onSuccessfulLogin with the response.
            // If it returns a 401 response, we catch it and instead resolve to null.
            return $http.get('/session').then(onSuccessfulLogin).catch(function () {
                return null;
            });
        };

        this.login = function (credentials) {
            return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
                return $q.reject({ message: 'Invalid login credentials.' });
            });
        };

        this.logout = function () {
            return $http.get('/logout').then(function () {
                Session.destroy();
                $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
            });
        };
    });

    app.service('Session', function ($rootScope, AUTH_EVENTS) {

        var self = this;

        $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
            self.destroy();
        });

        $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
            self.destroy();
        });

        this.user = null;

        this.create = function (user) {
            this.user = user;
        };

        this.destroy = function () {
            this.user = null;
        };
    });
})();

app.config(function ($stateProvider) {
    $stateProvider.state('Game', {
        url: '/game/:roomname',
        templateUrl: 'js/game-state/page.html',
        controller: "GameCtrl",
        data: {
            authenticate: true
        }
    });
});

app.controller('GameCtrl', function ($scope, BoardFactory, Socket, $stateParams, AuthService, $state, LobbyFactory, $rootScope, $q) {

    $scope.roomName = $stateParams.roomname;

    $scope.hideBoard = true;
    $scope.hideStart = true;
    $scope.hideCrabdance = true;
    $scope.crabdances = 0;
    $rootScope.hideNavbar = true;
    $scope.freeze = false;

    $scope.otherPlayers = [];
    $scope.messages = null;
    $scope.gameLength = 150;

    $scope.mouseIsDown = false;
    $scope.draggingAllowed = false;

    $scope.style = null;
    $scope.message = '';
    $scope.winOrLose = null;
    $scope.timeout = null;

    $scope.score = 0;

    $scope.exports = {
        wordObj: {},
        word: "",
        playerId: null,
        stateNumber: 0,
        pointsEarned: null
    };

    // $scope.checkSelected = function(id) {
    //     return id in $scope.exports.wordObj;
    // };

    $scope.toggleDrag = function () {
        $scope.draggingAllowed = !$scope.draggingAllowed;
    };

    $scope.mouseDown = function () {
        console.log('mouse is down');
        $scope.mouseIsDown = true;
    };

    $scope.mouseUp = function () {
        console.log('mouse is up');
        $scope.mouseIsDown = false;
        if ($scope.draggingAllowed && $scope.exports.word.length > 1) $scope.submit($scope.exports);
    };

    $scope.touchActivated = function () {
        console.log('touch is activated: ' + arguments);
        $scope.touchIsActivated = true;
    };

    $scope.touchStopped = function (e) {
        console.log('touch is stopped: ' + e);
        $scope.touchIsActivated = false;
        if ($scope.draggingAllowed && $scope.exports.word.length > 1) $scope.submit($scope.exports);
    };

    // $element.bind('touchstart', function (e) {
    //   $scope.isSelecting = true;
    //   $scope.click(e)
    // })

    // $element.bind('mousemove touchmove', function (e) {
    //   if ($scope.isSelecting) {
    //     $scope.click(e)
    //   }
    // })x

    // $element.bind('mouseup touchend', function (e) {
    //   $scope.isSelecting = false;
    //   if ($scope.draggingAllowed && $scope.exports.word.length > 1) $scope.submit($scope.exports);
    // })


    $scope.drag = function (space, id) {
        console.log('mouse enter: ' + id);
        if ($scope.mouseIsDown && $scope.draggingAllowed) {
            $scope.click(space, id);
        }
    };

    // function div_overlap(jqo, left, top) {
    //     console.log('div overlapped: ' + jqo);
    //     var d = jqo.offset();
    //     return top >= d.top && left >= d.left && left <= (d.left+jqo[0].offsetWidth) && top <= (d.top+jqo[0].offsetHeight);
    // }

    // touchmove = function(event) {
    //     // Prevent scrolling on this element
    //     event.preventDefault();
    // }

    // $(".cell").bind("mouseenter touchmove", function(evt){
    //     console.log('binding mouseenter and touchmove', evt);
    //     $(".cell").each(function() {
    //         console.log('for each element');
    //        if (div_overlap(this, evt.pageX, evt.pageY)){
    //         console.log('entering div_overlap');
    //           if (!this.hasClass('selected')) {
    //             this.addClass('selected');
    //           }
    //        }
    //     });
    // });

    // angular.element('.cell').on("click", function(evt){
    //     console.log('binding mouseenter and touchmove', evt);
    // $(".cell").each(function() {
    //     console.log('for each element');
    //    if (div_overlap(this, evt.pageX, evt.pageY)){
    //     console.log('entering div_overlap');
    //       if (!this.hasClass('selected')) {
    //         this.addClass('selected');
    //       }
    //    }
    // });
    // });

    // $element.children()(function(evt){
    //     console.log('binding mouseenter and touchmove', evt);
    // $(".cell").each(function() {
    //     console.log('for each element');
    //    if (div_overlap(this, evt.pageX, evt.pageY)){
    //     console.log('entering div_overlap');
    //       if (!this.hasClass('selected')) {
    //         this.addClass('selected');
    //       }
    //    }
    // });
    // });


    // $element.bind("touchmove", function(evt){
    //     console.log('binding mouseenter and touchmove', evt);
    //     // $(".cell").each(function() {
    //     //     console.log('for each element');
    //     //    if (div_overlap(this, evt.pageX, evt.pageY)){
    //     //     console.log('entering div_overlap');
    //     //       if (!this.hasClass('selected')) {
    //     //         this.addClass('selected');
    //     //       }
    //     //    }
    //     // });
    // });

    // angular.element('.cell').bind("touchmove", function(evt){
    //     console.log('binding mouseenter and touchmove', evt);
    //     angular.element('.cell').each(function() {
    //         console.log('for each element');
    //        if (div_overlap(this, evt.pageX, evt.pageY)){
    //         console.log('entering div_overlap');
    //           if (!this.hasClass('selected')) {
    //             this.addClass('selected');
    //           }
    //        }
    //     });
    // });

    $scope.mobileDrag = function (space, id) {
        console.log('touch is dragged: ' + space + " : " + id);
        if ($scope.touchIsActivated && $scope.draggingAllowed) {
            $scope.click(space, id);
        }
    };

    $scope.click = function (space, id) {
        if ($scope.freeze) {
            return;
        }
        console.log('clicked ', space, id);
        var ltrsSelected = Object.keys($scope.exports.wordObj);
        var previousLtr = ltrsSelected[ltrsSelected.length - 2];
        var lastLtr = ltrsSelected[ltrsSelected.length - 1];
        if (!ltrsSelected.length || validSelect(id, ltrsSelected)) {
            $scope.exports.word += space;
            $scope.exports.wordObj[id] = space;
            console.log($scope.exports);
        } else if (id === previousLtr) {
            $scope.exports.word = $scope.exports.word.substring(0, $scope.exports.word.length - 1);
            delete $scope.exports.wordObj[lastLtr];
        } else if (ltrsSelected.length === 1 && id === lastLtr) {
            $scope.exports.word = "";
            delete $scope.exports.wordObj[lastLtr];
        }
    };

    //get the current room info
    BoardFactory.getCurrentRoom($stateParams.roomname).then(function (room) {
        console.log(room);
        $scope.gameId = room.id;
        $scope.otherPlayers = room.users.filter(function (user) {
            return user.id !== $scope.user.id;
        });
        $scope.otherPlayers.forEach(function (player) {
            player.score = 0;
        });
        LobbyFactory.joinGame(room.id, $scope.user.id);
    });

    // Start the game when all players have joined room
    $scope.startGame = function () {
        var userIds = $scope.otherPlayers.map(function (user) {
            return user.id;
        });
        userIds.push($scope.user.id);
        console.log('op', $scope.otherPlayers, 'ui', userIds);
        $scope.winOrLose = null;
        BoardFactory.getStartBoard($scope.gameLength, $scope.gameId, userIds);
    };

    //Quit the room, back to lobby
    $scope.quit = function () {
        $rootScope.hideNavbar = false;
        $state.go('lobby');
    };

    //makes sure letter is adjacent to prev ltr, and hasn't been used yet
    function validSelect(ltrId, otherLtrsIds) {
        if (otherLtrsIds.includes(ltrId)) return false;
        var coords = ltrId.split('-');
        var row = coords[0];
        var col = coords[1];
        var lastLtrId = otherLtrsIds.pop();
        var coordsLast = lastLtrId.split('-');
        var rowLast = coordsLast[0];
        var colLast = coordsLast[1];
        var rowOffset = Math.abs(row - rowLast);
        var colOffset = Math.abs(col - colLast);
        return rowOffset <= 1 && colOffset <= 1;
    }

    function clearIfConflicting(updateWordObj, exportWordObj) {
        var tilesMoved = Object.keys(updateWordObj);
        var myWordTiles = Object.keys(exportWordObj);
        if (tilesMoved.some(function (coord) {
            return myWordTiles.includes(coord);
        })) $scope.clear();
    }

    $scope.clear = function () {
        $scope.exports.word = "";
        $scope.exports.wordObj = {};
    };

    $scope.submit = function (obj) {
        console.log('submitting ', obj);
        BoardFactory.submit(obj);
        $scope.clear();
    };

    $scope.shuffle = BoardFactory.shuffle;

    $scope.updateBoard = function (wordObj) {
        console.log('scope.board', $scope.board);
        for (var key in wordObj) {
            var coords = key.split('-');
            var row = coords[0];
            var col = coords[1];
            $scope.board[row][col] = wordObj[key];
        }
    };

    $scope.updateScore = function (points, playerId) {
        console.log('update score points', points);
        if (playerId === $scope.user.id) {
            $scope.score += points;
            $scope.exports.pointsEarned = null;
        } else {
            for (var player in $scope.otherPlayers) {
                if ($scope.otherPlayers[player].id === playerId) {
                    $scope.otherPlayers[player].score += points;
                    break;
                }
            }
            $scope.exports.pointsEarned = null;
        }
    };

    $scope.update = function (updateObj) {
        $scope.updateScore(updateObj.pointsEarned, updateObj.playerId);
        $scope.updateBoard(updateObj.wordObj);
        if (updateObj.word.length > 3 && updateObj.playerId != $scope.user.id) {
            if (!$scope.crabdances) crabdance();
            $scope.crabdances++;
        }
        if (+$scope.user.id === +updateObj.playerId) {
            var player = $scope.user.username;
        } else {
            for (var key in $scope.otherPlayers) {
                if (+$scope.otherPlayers[key].id === +updateObj.playerId) {
                    var player = $scope.otherPlayers[key].username;
                    break;
                }
            }
        }
        $scope.message = player + " played " + updateObj.word + " for " + updateObj.pointsEarned + " points!";
        if ($scope.timeout) {
            clearTimeout($scope.timeout);
        }
        $scope.timeout = setTimeout(function () {
            $scope.message = '';
        }, 3000);
        console.log('its updating!');
        clearIfConflicting(updateObj, $scope.exports.wordObj);
        $scope.exports.stateNumber = updateObj.stateNumber;
        $scope.$evalAsync();
    };

    function crabdance() {
        $scope.hideBoard = true;
        $scope.hideCrabdance = false;
        console.log('dance crab!', $scope.crabdances);
        setTimeout(function () {
            $scope.crabdances--;
            if ($scope.crabdances) {
                crabdance();
            } else {
                $scope.hideCrabdance = true;
                $scope.hideBoard = false;
            }
        }, 3000);
    }

    $scope.replay = function () {

        LobbyFactory.newGame({ roomname: $scope.roomName }).then(function (game) {
            console.log("replay game obj:", game);

            $scope.gameId = game.id;
            $scope.startGame();
            var allIds = $scope.otherPlayers.map(function (player) {
                return player.id;
            });
            allIds.push($scope.user.id);
            $q.all(allIds.map(function (id) {
                LobbyFactory.joinGame($scope.gameId, id);
            }));
        }).catch(function (e) {
            console.error('error restarting the game', e);
        });
    };

    $scope.determineWinner = function (winnersArray) {
        if (winnersArray.length === 1) {
            if (+winnersArray[0] === +$scope.user.id) {
                $scope.winOrLose = "Congratulation! You are a word wizard! You won!!!";
            } else {
                for (var player in $scope.otherPlayers) {
                    if (+$scope.otherPlayers[player].id === +winnersArray[0]) {
                        var winner = $scope.otherPlayers[player].username;
                        $scope.winOrLose = "Tough luck. " + winner + " has beaten you. Better Luck next time. :(";
                    }
                }
            }
        } else {
            var winners = [];
            for (var i in winnersArray) {
                if (+winnersArray[i] === +$scope.user.id) {
                    winners.push($scope.user.username);
                } else {
                    for (var player in $scope.otherPlayers) {
                        if ($scope.otherPlayers[player].id == winnersArray[i]) {
                            winners.push($scope.otherPlayers[player].username);
                            break;
                        }
                    }
                }
                console.log(winners);
                $scope.winOrLose = "The game was a tie between ";
                for (var i = 0; i < winners.length; i++) {
                    if (i === winners.length - 1) {
                        $scope.winOrLose += "and " + winners[i] + ".";
                    } else {
                        $scope.winOrLose += winners[i] + ", ";
                    }
                }
            }
        }
    };

    $scope.$on('$destroy', function () {
        console.log('destroyed');
        Socket.disconnect();
    });

    Socket.on('connect', function () {
        console.log('connecting');
        $q.all([AuthService.getLoggedInUser().then(function (user) {
            console.log('user from AuthService', user);
            $scope.user = user;
            $scope.exports.playerId = user.id;
        }),

        //get the current room info
        BoardFactory.getCurrentRoom($stateParams.roomname).then(function (room) {
            console.log(room);
            $scope.gameId = room.id;
            $scope.otherPlayers = room.users.filter(function (user) {
                return user.id !== $scope.user.id;
            });
            $scope.otherPlayers.forEach(function (player) {
                player.score = 0;
            });
            LobbyFactory.joinGame(room.id, $scope.user.id);
        })]).then(function () {
            Socket.emit('joinRoom', $scope.user, $scope.roomName, $scope.gameId);
            $scope.hideStart = false;
            $scope.$evalAsync();
            console.log('emitting "join room" event to server 8P', $scope.roomName);
        }).catch(function (e) {
            console.error('error grabbing user or room from db: ', e);
        });

        Socket.on('roomJoinSuccess', function (user) {
            console.log('new user joining', user.id);
            user.score = 0;
            $scope.otherPlayers.push(user);
            $scope.$evalAsync();
        });

        Socket.on('startBoard', function (board) {
            $scope.freeze = false;
            console.log('board! ', board);
            $scope.board = board;
            $scope.otherPlayers.forEach(function (player) {
                player.score = 0;
            });
            $scope.score = 0;
            $scope.hideStart = true;
            $scope.hideBoard = false;
            $scope.$evalAsync();
        });

        Socket.on('wordValidated', function (updateObj) {
            console.log('word is validated');
            $scope.update(updateObj);
            $scope.lastWordPlayed = updateObj.word;
            $scope.$evalAsync();
        });

        Socket.on('boardShuffled', function (board, userId, stateNumber) {
            $scope.board = board;
            $scope.updateScore(-5, userId);
            $scope.clear();
            $scope.exports.stateNumber = stateNumber;
            $scope.message = userId + " shuffled the board!";
            console.log($scope.message);
            $scope.$evalAsync();
        });

        Socket.on('playerDisconnected', function (user) {
            console.log('playerDisconnected', user.id);
            $scope.otherPlayers = $scope.otherPlayers.map(function (otherPlayers) {
                return otherPlayers.id !== user.id;
            });

            $scope.$evalAsync();
        });

        Socket.on('gameOver', function (winnersArray) {
            $scope.clear();
            $scope.freeze = true;
            $scope.determineWinner(winnersArray);
            $scope.$evalAsync();
            console.log('game is over, winners: ', winnersArray);
        });
    });
});

app.factory("BoardFactory", function ($http, Socket) {
    return {
        getStartBoard: function getStartBoard(gameLength, gameId, userIds) {
            console.log('factory. gl: ', gameLength);
            Socket.emit('getStartBoard', gameLength, gameId, userIds);
        },

        submit: function submit(obj) {
            Socket.emit('submitWord', obj);
        },

        shuffle: function shuffle(user) {
            console.log('gridfactory u', user.id);
            Socket.emit('shuffleBoard', user.id);
        },

        // findAllOtherUsers: function(game) {
        // 	return $http.get('/api/games/'+ game.id)
        // 	.then(res => res.data)
        // },

        getCurrentRoom: function getCurrentRoom(roomname) {
            return $http.get('/api/games/rooms/' + roomname).then(function (res) {
                return res.data;
            });
        },

        quitFromRoom: function quitFromRoom(gameId, userId) {
            // Socket.emit('disconnect', roomName, userId);
            return $http.delete('/api/games/' + gameId + '/' + userId);
        }
    };
});

app.controller('HomeCtrl', function ($scope, $state, $location) {
    $scope.enterLobby = function () {
        $state.go('lobby', { reload: true });
    };
});

app.config(function ($stateProvider) {
    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html'
    });
});

app.controller('LeaderBoardCtrl', function ($scope, LeaderBoardFactory, $state, AuthService) {
    console.log(' 1');
    LeaderBoardFactory.AllPlayers().then(function (players) {
        players.forEach(function (player) {
            if (player.games.length > 0) {
                var scores = player.games.map(function (game) {
                    return game.userGame.score;
                });
                player.highestScore = Math.max.apply(Math, _toConsumableArray(scores));
            } else {
                player.highestScore = 0;
            }
            player.games_won = player.winner.length;
            player.games_played = player.games.length;
            if (player.games.length === 0) {
                player.win_percentage = 0 + '%';
            } else {
                player.win_percentage = (player.winner.length / player.games.length * 100).toFixed(0) + '%';
            }
        });
        $scope.players = players;
    });
});

app.factory('LeaderBoardFactory', function ($http) {
    var LeaderBoardFactory = {};

    LeaderBoardFactory.AllPlayers = function () {
        return $http.get('/api/users').then(function (res) {
            return res.data;
        });
    };

    return LeaderBoardFactory;
});

app.config(function ($stateProvider) {

    $stateProvider.state('leaderBoard', {
        url: '/leaderBoard',
        templateUrl: 'js/leaderBoard/leaderBoard.template.html',
        resolve: {
            allPlayers: function allPlayers(LeaderBoardFactory) {
                return LeaderBoardFactory.AllPlayers;
            }

        },
        controller: 'LeaderBoardCtrl'
    });
});
app.directive('letter', function () {
    return {
        restrict: 'E',
        scope: {
            space: '=',
            x: '=',
            y: '=',
            draggingAllowed: '=',
            exports: '='
        },
        link: function link(scope, el, attr) {
            console.log('scope.draggingAllowed: ' + scope.draggingAllowed);

            scope.mouseIsDown = false;
            scope.touchIsActivated = false;

            scope.mouseDown = function () {
                console.log('mouse is down');
                scope.mouseIsDown = true;
            };

            scope.mouseUp = function () {
                console.log('mouse is up');
                scope.mouseIsDown = false;
                if (scope.draggingAllowed && scope.exports.word.length > 1) scope.submit(scope.exports);
            };

            scope.touchActivated = function () {
                console.log('touch is activated: ' + arguments);
                scope.touchIsActivated = true;
            };

            scope.touchStopped = function (e) {
                console.log('touch is stopped: ' + e);
                scope.touchIsActivated = false;
                if (scope.draggingAllowed && scope.exports.word.length > 1) scope.submit(scope.exports);
            };

            scope.drag = function (space, id) {
                console.log('mouse enter: ' + id);
                if (scope.mouseIsDown && scope.draggingAllowed) {
                    scope.click(space, id);
                }
            };

            function validSelect(ltrId, otherLtrsIds) {
                if (otherLtrsIds.includes(ltrId)) return false;
                var coords = ltrId.split('-');
                var row = coords[0];
                var col = coords[1];
                var lastLtrId = otherLtrsIds.pop();
                var coordsLast = lastLtrId.split('-');
                var rowLast = coordsLast[0];
                var colLast = coordsLast[1];
                var rowOffset = Math.abs(row - rowLast);
                var colOffset = Math.abs(col - colLast);
                return rowOffset <= 1 && colOffset <= 1;
            }

            scope.click = function (space, id) {
                if (scope.freeze) {
                    return;
                }
                console.log('clicked ', space, id);
                var ltrsSelected = Object.keys(scope.exports.wordObj);
                var previousLtr = ltrsSelected[ltrsSelected.length - 2];
                var lastLtr = ltrsSelected[ltrsSelected.length - 1];
                if (!ltrsSelected.length || validSelect(id, ltrsSelected)) {
                    scope.exports.word += space;
                    scope.exports.wordObj[id] = space;
                    console.log(scope.exports);
                } else if (id === previousLtr) {
                    scope.exports.word = scope.exports.word.substring(0, scope.exports.word.length - 1);
                    delete scope.exports.wordObj[lastLtr];
                } else if (ltrsSelected.length === 1 && id === lastLtr) {
                    scope.exports.word = "";
                    delete scope.exports.wordObj[lastLtr];
                }
            };

            function div_overlap(jqo, left, top) {
                console.log('div overlapped: ' + jqo);
                var d = jqo.offset();
                return top >= d.top && left >= d.left && left <= d.left + jqo[0].offsetWidth && top <= d.top + jqo[0].offsetHeight;
            }

            el.bind("touchmove", function (evt) {
                console.log('binding mouseenter and touchmove', evt);
                el.each(function () {
                    console.log('for each element');
                    if (div_overlap(this, evt.pageX, evt.pageY)) {
                        console.log('entering div_overlap');
                        if (!this.hasClass('selected')) {
                            this.addClass('selected');
                        }
                    }
                });
            });

            // scope.mobileDrag = function(space, id) {
            //     console.log('touch is dragged: ' + space + " : " + id);
            //     if($scope.touchIsActivated && $scope.draggingAllowed){
            //         $scope.click(space, id);
            //     }
            // };

        },
        templateUrl: '/js/letter/letter.template.html'
    };
});

app.controller('LobbyCtrl', function ($scope, LobbyFactory, rooms, $state, AuthService) {

    // AuthService.getLoggedInUser()
    //     .then(function(user) {
    //         $scope.user = user;
    //     });

    $scope.rooms = rooms;
    $scope.roomNameForm = false;
    // $scope.user = {
    //  id: 3
    // }

    // $scope.joinGame = function(room) {
    //     console.log("im changing state and reloading");
    //     $state.go('Game', { roomname: room.roomname }, { reload: true, notify: true })
    // };

    $scope.newRoom = function (roomInfo) {
        LobbyFactory.newGame(roomInfo);
        $scope.roomNameForm = false;
    };
    $scope.showForm = function () {
        $scope.roomNameForm = true;
    };
});

app.directive('enterLobby', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/lobby/lobby-button.html',
        controller: 'HomeCtrl'
    };
});

app.factory('LobbyFactory', function ($http) {
    var LobbyFactory = {};
    var tempRooms = []; //work with socket?

    LobbyFactory.getAllRooms = function () {
        return $http.get('/api/games/rooms').then(function (res) {
            return res.data;
        }).then(function (rooms) {
            angular.copy(rooms, tempRooms);
            return tempRooms;
        });
    };

    LobbyFactory.joinGame = function (roomId, userId) {
        console.log('lobby factory join game');
        return $http.put('/api/games/' + roomId + '/player', { id: userId }).then(function (res) {
            return res.data;
        });
    };

    LobbyFactory.newGame = function (roomInfo) {
        return $http.put('/api/games', roomInfo).then(function (res) {
            return res.data;
        }).then(function (room) {
            tempRooms.push(room);
            return room;
        });
    };

    LobbyFactory.AllPlayers = function () {
        return $http.get('/api/users').then(function (res) {
            return res.data;
        });
    };

    return LobbyFactory;
});

app.config(function ($stateProvider) {

    $stateProvider.state('lobby', {
        url: '/lobby',
        templateUrl: 'js/lobby/lobby.template.html',
        resolve: {
            rooms: function rooms(LobbyFactory) {
                return LobbyFactory.getAllRooms();
            }
        },
        controller: 'LobbyCtrl'
    });
});
app.config(function ($stateProvider) {

    $stateProvider.state('login', {
        url: '/login',
        templateUrl: 'js/login/login.html',
        controller: 'LoginCtrl'
    });
});

app.controller('LoginCtrl', function ($scope, AuthService, $state) {

    $scope.login = {};
    $scope.error = null;

    $scope.sendLogin = function (loginInfo) {

        $scope.error = null;

        AuthService.login(loginInfo).then(function () {
            $state.go('home');
        }).catch(function () {
            $scope.error = 'Invalid login credentials.';
        });
    };
});

app.config(function ($stateProvider) {

    $stateProvider.state('membersOnly', {
        url: '/members-area',
        template: '<img ng-repeat="item in stash" width="300" ng-src="{{ item }}" />',
        controller: function controller($scope, SecretStash) {
            SecretStash.getStash().then(function (stash) {
                $scope.stash = stash;
            });
        },
        // The following data.authenticate is read by an event listener
        // that controls access to this state. Refer to app.js.
        data: {
            authenticate: true
        }
    });
});

app.directive('rankDirective', function () {
    return {
        restrict: 'E',
        scope: {
            rankName: '@',
            players: '=',
            rankBy: '@',
            order: '@'
        },
        templateUrl: '/js/rank/rank.template.html'
    };
});
app.factory('SignupFactory', function ($http, $state, AuthService) {
    var SignupFactory = {};

    SignupFactory.createUser = function (signupInfo) {
        console.log(signupInfo);
        return $http.post('/signup', signupInfo).then(function (res) {
            if (res.status === 201) {
                AuthService.login({ email: signupInfo.email, password: signupInfo.password }).then(function (user) {
                    $state.go('home');
                });
            } else {
                throw Error('An account with that email already exists');
            }
        });
    };

    return SignupFactory;
});
app.config(function ($stateProvider) {

    $stateProvider.state('signup', {
        url: '/signup',
        templateUrl: 'js/signup/signup.html',
        controller: 'SignupCtrl'
    });
});

app.controller('SignupCtrl', function ($scope, AuthService, $state, SignupFactory) {

    $scope.signup = {};
    $scope.error = null;

    $scope.sendSignup = function (signupInfo) {
        SignupFactory.createUser(signupInfo).catch(function () {
            $scope.error = 'An account with that email already exists';
        });
    };
});

app.config(function ($stateProvider) {
    $stateProvider.state("UserProfile", {
        url: "/users/:userId",
        templateUrl: "js/user_profile/profile.template.html",
        controller: "UserCtrl"
    });
    $stateProvider.state("GameRecord", {
        url: "/users/:userId/games",
        templateUrl: "js/user_profile/games.html",
        controller: "GameRecordCtrl"
    });
});

app.controller("UserCtrl", function ($scope, UserFactory, $stateParams) {
    UserFactory.fetchInformation($stateParams.userId).then(function (user) {
        $scope.user = user;
        return user;
    }).then(function (user) {
        $scope.updated = $scope.user.updatedAt.getDay();
    });
});

app.controller("GameRecordCtrl", function ($scope, UserFactory, $stateParams) {
    UserFactory.fetchInformation($stateParams.userId).then(function (user) {
        $scope.user = user;
    }).then(function (user) {
        UserFactory.fetchGames($stateParams.userId);
    }).then(function (games) {
        $scope.games = games;
    });
});
app.factory("UserFactory", function ($http) {
    return {
        fetchInformation: function fetchInformation(id) {
            return $http.get("/api/users/" + id).then(function (user) {
                return user.data;
            });
        },
        fetchGames: function fetchGames(id) {
            return $http.get("/api/users/" + id + "/games").then(function (games) {
                return games.data;
            });
        }
    };
});
app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state) {

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'js/common/directives/navbar/navbar.html',
        link: function link(scope) {

            scope.items = [{ label: 'Home', state: 'home' }, { label: 'Leader Board', state: 'leaderBoard' }, { label: 'Your Profile', state: 'UserProfile', auth: true }];

            scope.user = null;

            scope.isLoggedIn = function () {
                return AuthService.isAuthenticated();
            };

            scope.logout = function () {
                AuthService.logout().then(function () {
                    $state.go('home');
                });
            };

            var setUser = function setUser() {
                AuthService.getLoggedInUser().then(function (user) {
                    scope.user = user;
                });
            };

            var removeUser = function removeUser() {
                scope.user = null;
            };

            setUser();

            $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser);
            $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser);
            $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser);
        }

    };
});

'use strict';

app.directive('oauthButton', function () {
    return {
        scope: {
            providerName: '@'
        },
        restrict: 'E',
        templateUrl: 'js/common/directives/oauth-button/oauth-button.html'
    };
});

app.directive("timer", function ($q, $interval, Socket) {
    return {
        restrict: 'E',
        scope: {
            time: '='
        },
        templateUrl: "js/common/directives/timer/timer.html",
        link: function link(scope) {
            var time = scope.time;
            var start = scope.time;
            scope.time_remaining = convert(time);
            scope.countdown = function () {
                var timer = $interval(function () {
                    time -= 1;
                    scope.time_remaining = convert(time);
                    if (time < 1) {
                        scope.time_remaining = "Time up!";
                        $interval.cancel(timer);
                        time = start;
                    }
                }, 1000);
            };

            // scope.messages = ["Get Ready!", "Get Set!", "Go!", '/'];
            //     var index = 0;
            //     var prepare = $interval(function() {
            //         scope.time_remaining = scope.messages[index];
            //         index++;
            //         console.log(scope.time_remaining);
            //         if (scope.time_remaining === "/") {
            //             scope.time_remaining = convert(time);
            //             $interval.cancel(prepare);
            //             var timer = $interval(function() {
            //                 time -= 1;
            //                 scope.time_remaining = convert(time);
            //                 if (time < 1) {
            //                     scope.time_remaining = "Time up!";
            //                     $interval.cancel(timer);
            //                 }
            //             }, 1000);
            //         }
            //     }, 1000);
            // };

            Socket.on('startBoard', function () {
                scope.countdown(time);
            });

            function convert(time) {
                var seconds = (time % 60).toString();
                var conversion = Math.floor(time / 60) + ':';
                if (seconds.length < 2) {
                    conversion += '0' + seconds;
                } else {
                    conversion += seconds;
                }
                return conversion;
            }
        }
    };
});

app.directive('logo', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/logo/logo.html'
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImZzYS9mc2EtcHJlLWJ1aWx0LmpzIiwiZ2FtZS1zdGF0ZS9ncmlkLmNvbnRyb2xsZXIuanMiLCJnYW1lLXN0YXRlL2dyaWQuZmFjdG9yeS5qcyIsImhvbWUvaG9tZS5jb250cm9sbGVyLmpzIiwiaG9tZS9ob21lLmpzIiwibGVhZGVyQm9hcmQvbGVhZGVyQm9hcmQuY29udHJvbGxlci5qcyIsImxlYWRlckJvYXJkL2xlYWRlckJvYXJkLmZhY3RvcnkuanMiLCJsZWFkZXJCb2FyZC9sZWFkZXJCb2FyZC5zdGF0ZS5qcyIsImxldHRlci9sZXR0ZXIuZGlyZWN0aXZlLmpzIiwibG9iYnkvbG9iYnkuY29udHJvbGxlci5qcyIsImxvYmJ5L2xvYmJ5LmRpcmVjdGl2ZS5qcyIsImxvYmJ5L2xvYmJ5LmZhY3RvcnkuanMiLCJsb2JieS9sb2JieS5zdGF0ZS5qcyIsImxvZ2luL2xvZ2luLmpzIiwibWVtYmVycy1vbmx5L21lbWJlcnMtb25seS5qcyIsInJhbmsvcmFuay5kaXJlY3RpdmUuanMiLCJzaWdudXAvc2lnbnVwLmZhY3RvcnkuanMiLCJzaWdudXAvc2lnbnVwLmpzIiwidXNlcl9wcm9maWxlL3Byb2ZpbGUuY29udHJvbGxlci5qcyIsInVzZXJfcHJvZmlsZS9wcm9maWxlLmZhY3RvcnkuanMiLCJjb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvb2F1dGgtYnV0dG9uL29hdXRoLWJ1dHRvbi5kaXJlY3RpdmUuanMiLCJjb21tb24vZGlyZWN0aXZlcy90aW1lci90aW1lci5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL2xvZ28vbG9nby5qcyJdLCJuYW1lcyI6WyJ3aW5kb3ciLCJhcHAiLCJhbmd1bGFyIiwibW9kdWxlIiwiY29uZmlnIiwiJHVybFJvdXRlclByb3ZpZGVyIiwiJGxvY2F0aW9uUHJvdmlkZXIiLCJodG1sNU1vZGUiLCJvdGhlcndpc2UiLCJ3aGVuIiwibG9jYXRpb24iLCJyZWxvYWQiLCJydW4iLCIkcm9vdFNjb3BlIiwiJG9uIiwiZXZlbnQiLCJ0b1N0YXRlIiwidG9QYXJhbXMiLCJmcm9tU3RhdGUiLCJmcm9tUGFyYW1zIiwidGhyb3duRXJyb3IiLCJjb25zb2xlIiwiaW5mbyIsIm5hbWUiLCJlcnJvciIsIkF1dGhTZXJ2aWNlIiwiJHN0YXRlIiwiZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCIsInN0YXRlIiwiZGF0YSIsImF1dGhlbnRpY2F0ZSIsImlzQXV0aGVudGljYXRlZCIsInByZXZlbnREZWZhdWx0IiwiZ2V0TG9nZ2VkSW5Vc2VyIiwidGhlbiIsInVzZXIiLCJnbyIsIkVycm9yIiwiZmFjdG9yeSIsImlvIiwib3JpZ2luIiwiY29uc3RhbnQiLCJsb2dpblN1Y2Nlc3MiLCJsb2dpbkZhaWxlZCIsImxvZ291dFN1Y2Nlc3MiLCJzZXNzaW9uVGltZW91dCIsIm5vdEF1dGhlbnRpY2F0ZWQiLCJub3RBdXRob3JpemVkIiwiJHEiLCJBVVRIX0VWRU5UUyIsInN0YXR1c0RpY3QiLCJyZXNwb25zZUVycm9yIiwicmVzcG9uc2UiLCIkYnJvYWRjYXN0Iiwic3RhdHVzIiwicmVqZWN0IiwiJGh0dHBQcm92aWRlciIsImludGVyY2VwdG9ycyIsInB1c2giLCIkaW5qZWN0b3IiLCJnZXQiLCJzZXJ2aWNlIiwiJGh0dHAiLCJTZXNzaW9uIiwib25TdWNjZXNzZnVsTG9naW4iLCJjcmVhdGUiLCJmcm9tU2VydmVyIiwiY2F0Y2giLCJsb2dpbiIsImNyZWRlbnRpYWxzIiwicG9zdCIsIm1lc3NhZ2UiLCJsb2dvdXQiLCJkZXN0cm95Iiwic2VsZiIsIiRzdGF0ZVByb3ZpZGVyIiwidXJsIiwidGVtcGxhdGVVcmwiLCJjb250cm9sbGVyIiwiJHNjb3BlIiwiQm9hcmRGYWN0b3J5IiwiU29ja2V0IiwiJHN0YXRlUGFyYW1zIiwiTG9iYnlGYWN0b3J5Iiwicm9vbU5hbWUiLCJyb29tbmFtZSIsImhpZGVCb2FyZCIsImhpZGVTdGFydCIsImhpZGVDcmFiZGFuY2UiLCJjcmFiZGFuY2VzIiwiaGlkZU5hdmJhciIsImZyZWV6ZSIsIm90aGVyUGxheWVycyIsIm1lc3NhZ2VzIiwiZ2FtZUxlbmd0aCIsIm1vdXNlSXNEb3duIiwiZHJhZ2dpbmdBbGxvd2VkIiwic3R5bGUiLCJ3aW5Pckxvc2UiLCJ0aW1lb3V0Iiwic2NvcmUiLCJleHBvcnRzIiwid29yZE9iaiIsIndvcmQiLCJwbGF5ZXJJZCIsInN0YXRlTnVtYmVyIiwicG9pbnRzRWFybmVkIiwidG9nZ2xlRHJhZyIsIm1vdXNlRG93biIsImxvZyIsIm1vdXNlVXAiLCJsZW5ndGgiLCJzdWJtaXQiLCJ0b3VjaEFjdGl2YXRlZCIsImFyZ3VtZW50cyIsInRvdWNoSXNBY3RpdmF0ZWQiLCJ0b3VjaFN0b3BwZWQiLCJlIiwiZHJhZyIsInNwYWNlIiwiaWQiLCJjbGljayIsIm1vYmlsZURyYWciLCJsdHJzU2VsZWN0ZWQiLCJPYmplY3QiLCJrZXlzIiwicHJldmlvdXNMdHIiLCJsYXN0THRyIiwidmFsaWRTZWxlY3QiLCJzdWJzdHJpbmciLCJnZXRDdXJyZW50Um9vbSIsInJvb20iLCJnYW1lSWQiLCJ1c2VycyIsImZpbHRlciIsImZvckVhY2giLCJwbGF5ZXIiLCJqb2luR2FtZSIsInN0YXJ0R2FtZSIsInVzZXJJZHMiLCJtYXAiLCJnZXRTdGFydEJvYXJkIiwicXVpdCIsImx0cklkIiwib3RoZXJMdHJzSWRzIiwiaW5jbHVkZXMiLCJjb29yZHMiLCJzcGxpdCIsInJvdyIsImNvbCIsImxhc3RMdHJJZCIsInBvcCIsImNvb3Jkc0xhc3QiLCJyb3dMYXN0IiwiY29sTGFzdCIsInJvd09mZnNldCIsIk1hdGgiLCJhYnMiLCJjb2xPZmZzZXQiLCJjbGVhcklmQ29uZmxpY3RpbmciLCJ1cGRhdGVXb3JkT2JqIiwiZXhwb3J0V29yZE9iaiIsInRpbGVzTW92ZWQiLCJteVdvcmRUaWxlcyIsInNvbWUiLCJjb29yZCIsImNsZWFyIiwib2JqIiwic2h1ZmZsZSIsInVwZGF0ZUJvYXJkIiwiYm9hcmQiLCJrZXkiLCJ1cGRhdGVTY29yZSIsInBvaW50cyIsInVwZGF0ZSIsInVwZGF0ZU9iaiIsImNyYWJkYW5jZSIsInVzZXJuYW1lIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsIiRldmFsQXN5bmMiLCJyZXBsYXkiLCJuZXdHYW1lIiwiZ2FtZSIsImFsbElkcyIsImFsbCIsImRldGVybWluZVdpbm5lciIsIndpbm5lcnNBcnJheSIsIndpbm5lciIsIndpbm5lcnMiLCJpIiwiZGlzY29ubmVjdCIsIm9uIiwiZW1pdCIsImxhc3RXb3JkUGxheWVkIiwidXNlcklkIiwicmVzIiwicXVpdEZyb21Sb29tIiwiZGVsZXRlIiwiJGxvY2F0aW9uIiwiZW50ZXJMb2JieSIsIkxlYWRlckJvYXJkRmFjdG9yeSIsIkFsbFBsYXllcnMiLCJwbGF5ZXJzIiwiZ2FtZXMiLCJzY29yZXMiLCJ1c2VyR2FtZSIsImhpZ2hlc3RTY29yZSIsIm1heCIsImdhbWVzX3dvbiIsImdhbWVzX3BsYXllZCIsIndpbl9wZXJjZW50YWdlIiwidG9GaXhlZCIsInJlc29sdmUiLCJhbGxQbGF5ZXJzIiwiZGlyZWN0aXZlIiwicmVzdHJpY3QiLCJzY29wZSIsIngiLCJ5IiwibGluayIsImVsIiwiYXR0ciIsImRpdl9vdmVybGFwIiwianFvIiwibGVmdCIsInRvcCIsImQiLCJvZmZzZXQiLCJvZmZzZXRXaWR0aCIsIm9mZnNldEhlaWdodCIsImJpbmQiLCJldnQiLCJlYWNoIiwicGFnZVgiLCJwYWdlWSIsImhhc0NsYXNzIiwiYWRkQ2xhc3MiLCJyb29tcyIsInJvb21OYW1lRm9ybSIsIm5ld1Jvb20iLCJyb29tSW5mbyIsInNob3dGb3JtIiwidGVtcFJvb21zIiwiZ2V0QWxsUm9vbXMiLCJjb3B5Iiwicm9vbUlkIiwicHV0Iiwic2VuZExvZ2luIiwibG9naW5JbmZvIiwidGVtcGxhdGUiLCJTZWNyZXRTdGFzaCIsImdldFN0YXNoIiwic3Rhc2giLCJyYW5rTmFtZSIsInJhbmtCeSIsIm9yZGVyIiwiU2lnbnVwRmFjdG9yeSIsImNyZWF0ZVVzZXIiLCJzaWdudXBJbmZvIiwiZW1haWwiLCJwYXNzd29yZCIsInNpZ251cCIsInNlbmRTaWdudXAiLCJVc2VyRmFjdG9yeSIsImZldGNoSW5mb3JtYXRpb24iLCJ1cGRhdGVkIiwidXBkYXRlZEF0IiwiZ2V0RGF5IiwiZmV0Y2hHYW1lcyIsIml0ZW1zIiwibGFiZWwiLCJhdXRoIiwiaXNMb2dnZWRJbiIsInNldFVzZXIiLCJyZW1vdmVVc2VyIiwicHJvdmlkZXJOYW1lIiwiJGludGVydmFsIiwidGltZSIsInN0YXJ0IiwidGltZV9yZW1haW5pbmciLCJjb252ZXJ0IiwiY291bnRkb3duIiwidGltZXIiLCJjYW5jZWwiLCJzZWNvbmRzIiwidG9TdHJpbmciLCJjb252ZXJzaW9uIiwiZmxvb3IiXSwibWFwcGluZ3MiOiJBQUFBOzs7O0FBQ0FBLE9BQUFDLEdBQUEsR0FBQUMsUUFBQUMsTUFBQSxDQUFBLHVCQUFBLEVBQUEsQ0FBQSxhQUFBLEVBQUEsV0FBQSxFQUFBLGNBQUEsRUFBQSxXQUFBLEVBQUEsU0FBQSxDQUFBLENBQUE7O0FBRUFGLElBQUFHLE1BQUEsQ0FBQSxVQUFBQyxrQkFBQSxFQUFBQyxpQkFBQSxFQUFBO0FBQ0E7QUFDQUEsc0JBQUFDLFNBQUEsQ0FBQSxJQUFBO0FBQ0E7QUFDQUYsdUJBQUFHLFNBQUEsQ0FBQSxHQUFBO0FBQ0E7QUFDQUgsdUJBQUFJLElBQUEsQ0FBQSxpQkFBQSxFQUFBLFlBQUE7QUFDQVQsZUFBQVUsUUFBQSxDQUFBQyxNQUFBO0FBQ0EsS0FGQTtBQUdBLENBVEE7O0FBV0E7QUFDQVYsSUFBQVcsR0FBQSxDQUFBLFVBQUFDLFVBQUEsRUFBQTtBQUNBQSxlQUFBQyxHQUFBLENBQUEsbUJBQUEsRUFBQSxVQUFBQyxLQUFBLEVBQUFDLE9BQUEsRUFBQUMsUUFBQSxFQUFBQyxTQUFBLEVBQUFDLFVBQUEsRUFBQUMsV0FBQSxFQUFBO0FBQ0FDLGdCQUFBQyxJQUFBLGdGQUFBTixRQUFBTyxJQUFBO0FBQ0FGLGdCQUFBRyxLQUFBLENBQUFKLFdBQUE7QUFDQSxLQUhBO0FBSUEsQ0FMQTs7QUFPQTtBQUNBbkIsSUFBQVcsR0FB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OiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdGdWxsc3RhY2tHZW5lcmF0ZWRBcHAnLCBbJ2ZzYVByZUJ1aWx0JywgJ3VpLnJvdXRlcicsICd1aS5ib290c3RyYXAnLCAnbmdBbmltYXRlJywgJ25nVG91Y2gnXSk7XG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgIC8vIElmIHdlIGdvIHRvIGEgVVJMIHRoYXQgdWktcm91dGVyIGRvZXNuJ3QgaGF2ZSByZWdpc3RlcmVkLCBnbyB0byB0aGUgXCIvXCIgdXJsLlxuICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy8nKTtcbiAgICAvLyBUcmlnZ2VyIHBhZ2UgcmVmcmVzaCB3aGVuIGFjY2Vzc2luZyBhbiBPQXV0aCByb3V0ZVxuICAgICR1cmxSb3V0ZXJQcm92aWRlci53aGVuKCcvYXV0aC86cHJvdmlkZXInLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcbiAgICB9KTtcbn0pO1xuXG4vLyBUaGlzIGFwcC5ydW4gaXMgZm9yIGxpc3RlbmluZyB0byBlcnJvcnMgYnJvYWRjYXN0ZWQgYnkgdWktcm91dGVyLCB1c3VhbGx5IG9yaWdpbmF0aW5nIGZyb20gcmVzb2x2ZXNcbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUpIHtcbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlRXJyb3InLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zLCBmcm9tU3RhdGUsIGZyb21QYXJhbXMsIHRocm93bkVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuaW5mbyhgVGhlIGZvbGxvd2luZyBlcnJvciB3YXMgdGhyb3duIGJ5IHVpLXJvdXRlciB3aGlsZSB0cmFuc2l0aW9uaW5nIHRvIHN0YXRlIFwiJHt0b1N0YXRlLm5hbWV9XCIuIFRoZSBvcmlnaW4gb2YgdGhpcyBlcnJvciBpcyBwcm9iYWJseSBhIHJlc29sdmUgZnVuY3Rpb246YCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IodGhyb3duRXJyb3IpO1xuICAgIH0pO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgY29udHJvbGxpbmcgYWNjZXNzIHRvIHNwZWNpZmljIHN0YXRlcy5cbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgIC8vIFRoZSBnaXZlbiBzdGF0ZSByZXF1aXJlcyBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gICAgdmFyIGRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGggPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5hdXRoZW50aWNhdGU7XG4gICAgfTtcblxuICAgIC8vICRzdGF0ZUNoYW5nZVN0YXJ0IGlzIGFuIGV2ZW50IGZpcmVkXG4gICAgLy8gd2hlbmV2ZXIgdGhlIHByb2Nlc3Mgb2YgY2hhbmdpbmcgYSBzdGF0ZSBiZWdpbnMuXG4gICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN0YXJ0JywgZnVuY3Rpb24gKGV2ZW50LCB0b1N0YXRlLCB0b1BhcmFtcykge1xuXG4gICAgICAgIGlmICghZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCh0b1N0YXRlKSkge1xuICAgICAgICAgICAgLy8gVGhlIGRlc3RpbmF0aW9uIHN0YXRlIGRvZXMgbm90IHJlcXVpcmUgYXV0aGVudGljYXRpb25cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgICAgICAgIC8vIFRoZSB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQuXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FuY2VsIG5hdmlnYXRpbmcgdG8gbmV3IHN0YXRlLlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIC8vIElmIGEgdXNlciBpcyByZXRyaWV2ZWQsIHRoZW4gcmVuYXZpZ2F0ZSB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgICAgICAgIC8vICh0aGUgc2Vjb25kIHRpbWUsIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpIHdpbGwgd29yaylcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSwgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4sIGdvIHRvIFwibG9naW5cIiBzdGF0ZS5cbiAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKHRvU3RhdGUubmFtZSwgdG9QYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2xvZ2luJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSk7XG5cbn0pO1xuIiwiKGZ1bmN0aW9uICgpIHtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8vIEhvcGUgeW91IGRpZG4ndCBmb3JnZXQgQW5ndWxhciEgRHVoLWRveS5cbiAgICBpZiAoIXdpbmRvdy5hbmd1bGFyKSB0aHJvdyBuZXcgRXJyb3IoJ0kgY2FuXFwndCBmaW5kIEFuZ3VsYXIhJyk7XG5cbiAgICB2YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ2ZzYVByZUJ1aWx0JywgW10pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ1NvY2tldCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF3aW5kb3cuaW8pIHRocm93IG5ldyBFcnJvcignc29ja2V0LmlvIG5vdCBmb3VuZCEnKTtcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5pbyh3aW5kb3cubG9jYXRpb24ub3JpZ2luKTtcbiAgICB9KTtcblxuICAgIC8vIEFVVEhfRVZFTlRTIGlzIHVzZWQgdGhyb3VnaG91dCBvdXIgYXBwIHRvXG4gICAgLy8gYnJvYWRjYXN0IGFuZCBsaXN0ZW4gZnJvbSBhbmQgdG8gdGhlICRyb290U2NvcGVcbiAgICAvLyBmb3IgaW1wb3J0YW50IGV2ZW50cyBhYm91dCBhdXRoZW50aWNhdGlvbiBmbG93LlxuICAgIGFwcC5jb25zdGFudCgnQVVUSF9FVkVOVFMnLCB7XG4gICAgICAgIGxvZ2luU3VjY2VzczogJ2F1dGgtbG9naW4tc3VjY2VzcycsXG4gICAgICAgIGxvZ2luRmFpbGVkOiAnYXV0aC1sb2dpbi1mYWlsZWQnLFxuICAgICAgICBsb2dvdXRTdWNjZXNzOiAnYXV0aC1sb2dvdXQtc3VjY2VzcycsXG4gICAgICAgIHNlc3Npb25UaW1lb3V0OiAnYXV0aC1zZXNzaW9uLXRpbWVvdXQnLFxuICAgICAgICBub3RBdXRoZW50aWNhdGVkOiAnYXV0aC1ub3QtYXV0aGVudGljYXRlZCcsXG4gICAgICAgIG5vdEF1dGhvcml6ZWQ6ICdhdXRoLW5vdC1hdXRob3JpemVkJ1xuICAgIH0pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ0F1dGhJbnRlcmNlcHRvcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCAkcSwgQVVUSF9FVkVOVFMpIHtcbiAgICAgICAgdmFyIHN0YXR1c0RpY3QgPSB7XG4gICAgICAgICAgICA0MDE6IEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsXG4gICAgICAgICAgICA0MDM6IEFVVEhfRVZFTlRTLm5vdEF1dGhvcml6ZWQsXG4gICAgICAgICAgICA0MTk6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LFxuICAgICAgICAgICAgNDQwOiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVzcG9uc2VFcnJvcjogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KHN0YXR1c0RpY3RbcmVzcG9uc2Uuc3RhdHVzXSwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QocmVzcG9uc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSk7XG5cbiAgICBhcHAuY29uZmlnKGZ1bmN0aW9uICgkaHR0cFByb3ZpZGVyKSB7XG4gICAgICAgICRodHRwUHJvdmlkZXIuaW50ZXJjZXB0b3JzLnB1c2goW1xuICAgICAgICAgICAgJyRpbmplY3RvcicsXG4gICAgICAgICAgICBmdW5jdGlvbiAoJGluamVjdG9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRpbmplY3Rvci5nZXQoJ0F1dGhJbnRlcmNlcHRvcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICBdKTtcbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdBdXRoU2VydmljZScsIGZ1bmN0aW9uICgkaHR0cCwgU2Vzc2lvbiwgJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMsICRxKSB7XG5cbiAgICAgICAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciB1c2VyID0gcmVzcG9uc2UuZGF0YS51c2VyO1xuICAgICAgICAgICAgU2Vzc2lvbi5jcmVhdGUodXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzKTtcbiAgICAgICAgICAgIHJldHVybiB1c2VyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlcyB0aGUgc2Vzc2lvbiBmYWN0b3J5IHRvIHNlZSBpZiBhblxuICAgICAgICAvLyBhdXRoZW50aWNhdGVkIHVzZXIgaXMgY3VycmVudGx5IHJlZ2lzdGVyZWQuXG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhU2Vzc2lvbi51c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyID0gZnVuY3Rpb24gKGZyb21TZXJ2ZXIpIHtcblxuICAgICAgICAgICAgLy8gSWYgYW4gYXV0aGVudGljYXRlZCBzZXNzaW9uIGV4aXN0cywgd2VcbiAgICAgICAgICAgIC8vIHJldHVybiB0aGUgdXNlciBhdHRhY2hlZCB0byB0aGF0IHNlc3Npb25cbiAgICAgICAgICAgIC8vIHdpdGggYSBwcm9taXNlLiBUaGlzIGVuc3VyZXMgdGhhdCB3ZSBjYW5cbiAgICAgICAgICAgIC8vIGFsd2F5cyBpbnRlcmZhY2Ugd2l0aCB0aGlzIG1ldGhvZCBhc3luY2hyb25vdXNseS5cblxuICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgaWYgdHJ1ZSBpcyBnaXZlbiBhcyB0aGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIsXG4gICAgICAgICAgICAvLyB0aGVuIHRoaXMgY2FjaGVkIHZhbHVlIHdpbGwgbm90IGJlIHVzZWQuXG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCgpICYmIGZyb21TZXJ2ZXIgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEud2hlbihTZXNzaW9uLnVzZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNYWtlIHJlcXVlc3QgR0VUIC9zZXNzaW9uLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIHVzZXIsIGNhbGwgb25TdWNjZXNzZnVsTG9naW4gd2l0aCB0aGUgcmVzcG9uc2UuXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgNDAxIHJlc3BvbnNlLCB3ZSBjYXRjaCBpdCBhbmQgaW5zdGVhZCByZXNvbHZlIHRvIG51bGwuXG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QoeyBtZXNzYWdlOiAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2xvZ291dCcpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIFNlc3Npb24uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnU2Vzc2lvbicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUykge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlID0gZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IHVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG59KCkpO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbigkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdHYW1lJywge1xuICAgICAgICB1cmw6ICcvZ2FtZS86cm9vbW5hbWUnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2dhbWUtc3RhdGUvcGFnZS5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogXCJHYW1lQ3RybFwiLFxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBhdXRoZW50aWNhdGU6IHRydWVcbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG5cblxuYXBwLmNvbnRyb2xsZXIoJ0dhbWVDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBCb2FyZEZhY3RvcnksIFNvY2tldCwgJHN0YXRlUGFyYW1zLCBBdXRoU2VydmljZSwgJHN0YXRlLCBMb2JieUZhY3RvcnksICRyb290U2NvcGUsICRxKSB7XG5cbiAgICAkc2NvcGUucm9vbU5hbWUgPSAkc3RhdGVQYXJhbXMucm9vbW5hbWU7XG5cbiAgICAkc2NvcGUuaGlkZUJvYXJkID0gdHJ1ZTtcbiAgICAkc2NvcGUuaGlkZVN0YXJ0ID0gdHJ1ZTtcbiAgICAkc2NvcGUuaGlkZUNyYWJkYW5jZSA9IHRydWU7XG4gICAgJHNjb3BlLmNyYWJkYW5jZXMgPSAwO1xuICAgICRyb290U2NvcGUuaGlkZU5hdmJhciA9IHRydWU7XG4gICAgJHNjb3BlLmZyZWV6ZSA9IGZhbHNlO1xuXG4gICAgJHNjb3BlLm90aGVyUGxheWVycyA9IFtdO1xuICAgICRzY29wZS5tZXNzYWdlcyA9IG51bGw7XG4gICAgJHNjb3BlLmdhbWVMZW5ndGggPSAxNTA7XG5cbiAgICAkc2NvcGUubW91c2VJc0Rvd24gPSBmYWxzZTtcbiAgICAkc2NvcGUuZHJhZ2dpbmdBbGxvd2VkID0gZmFsc2U7XG5cbiAgICAkc2NvcGUuc3R5bGUgPSBudWxsO1xuICAgICRzY29wZS5tZXNzYWdlID0gJyc7XG4gICAgJHNjb3BlLndpbk9yTG9zZSA9IG51bGw7XG4gICAgJHNjb3BlLnRpbWVvdXQgPSBudWxsO1xuXG4gICAgJHNjb3BlLnNjb3JlID0gMDtcblxuICAgICRzY29wZS5leHBvcnRzID0ge1xuICAgICAgICB3b3JkT2JqOiB7fSxcbiAgICAgICAgd29yZDogXCJcIixcbiAgICAgICAgcGxheWVySWQ6IG51bGwsXG4gICAgICAgIHN0YXRlTnVtYmVyOiAwLFxuICAgICAgICBwb2ludHNFYXJuZWQ6IG51bGxcbiAgICB9O1xuXG5cblxuICAgIC8vICRzY29wZS5jaGVja1NlbGVjdGVkID0gZnVuY3Rpb24oaWQpIHtcbiAgICAvLyAgICAgcmV0dXJuIGlkIGluICRzY29wZS5leHBvcnRzLndvcmRPYmo7XG4gICAgLy8gfTtcblxuICAgICRzY29wZS50b2dnbGVEcmFnID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICRzY29wZS5kcmFnZ2luZ0FsbG93ZWQgPSAhJHNjb3BlLmRyYWdnaW5nQWxsb3dlZDtcbiAgICB9O1xuXG4gICAgJHNjb3BlLm1vdXNlRG93biA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb25zb2xlLmxvZygnbW91c2UgaXMgZG93bicpXG4gICAgICAgICRzY29wZS5tb3VzZUlzRG93biA9IHRydWU7XG4gICAgfTtcblxuICAgICRzY29wZS5tb3VzZVVwID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdtb3VzZSBpcyB1cCcpO1xuICAgICAgICAkc2NvcGUubW91c2VJc0Rvd24gPSBmYWxzZTtcbiAgICAgICAgaWYgKCRzY29wZS5kcmFnZ2luZ0FsbG93ZWQgJiYgJHNjb3BlLmV4cG9ydHMud29yZC5sZW5ndGggPiAxKSAkc2NvcGUuc3VibWl0KCRzY29wZS5leHBvcnRzKTtcbiAgICB9O1xuXG4gICAgJHNjb3BlLnRvdWNoQWN0aXZhdGVkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCd0b3VjaCBpcyBhY3RpdmF0ZWQ6ICcgKyBhcmd1bWVudHMpO1xuICAgICAgICAkc2NvcGUudG91Y2hJc0FjdGl2YXRlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgJHNjb3BlLnRvdWNoU3RvcHBlZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ3RvdWNoIGlzIHN0b3BwZWQ6ICcgKyBlKTtcbiAgICAgICAgJHNjb3BlLnRvdWNoSXNBY3RpdmF0ZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKCRzY29wZS5kcmFnZ2luZ0FsbG93ZWQgJiYgJHNjb3BlLmV4cG9ydHMud29yZC5sZW5ndGggPiAxKSAkc2NvcGUuc3VibWl0KCRzY29wZS5leHBvcnRzKTtcbiAgICB9XG5cbiAgICAvLyAkZWxlbWVudC5iaW5kKCd0b3VjaHN0YXJ0JywgZnVuY3Rpb24gKGUpIHtcbiAgICAvLyAgICRzY29wZS5pc1NlbGVjdGluZyA9IHRydWU7XG4gICAgLy8gICAkc2NvcGUuY2xpY2soZSlcbiAgICAvLyB9KVxuXG4gICAgLy8gJGVsZW1lbnQuYmluZCgnbW91c2Vtb3ZlIHRvdWNobW92ZScsIGZ1bmN0aW9uIChlKSB7XG4gICAgLy8gICBpZiAoJHNjb3BlLmlzU2VsZWN0aW5nKSB7XG4gICAgLy8gICAgICRzY29wZS5jbGljayhlKVxuICAgIC8vICAgfVxuICAgIC8vIH0peFxuXG4gICAgLy8gJGVsZW1lbnQuYmluZCgnbW91c2V1cCB0b3VjaGVuZCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgLy8gICAkc2NvcGUuaXNTZWxlY3RpbmcgPSBmYWxzZTtcbiAgICAvLyAgIGlmICgkc2NvcGUuZHJhZ2dpbmdBbGxvd2VkICYmICRzY29wZS5leHBvcnRzLndvcmQubGVuZ3RoID4gMSkgJHNjb3BlLnN1Ym1pdCgkc2NvcGUuZXhwb3J0cyk7XG4gICAgLy8gfSlcblxuXG4gICAgJHNjb3BlLmRyYWcgPSBmdW5jdGlvbihzcGFjZSwgaWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ21vdXNlIGVudGVyOiAnICsgaWQpO1xuICAgICAgICBpZiAoJHNjb3BlLm1vdXNlSXNEb3duICYmICRzY29wZS5kcmFnZ2luZ0FsbG93ZWQpIHtcbiAgICAgICAgICAgICRzY29wZS5jbGljayhzcGFjZSwgaWQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGZ1bmN0aW9uIGRpdl9vdmVybGFwKGpxbywgbGVmdCwgdG9wKSB7XG4gICAgLy8gICAgIGNvbnNvbGUubG9nKCdkaXYgb3ZlcmxhcHBlZDogJyArIGpxbyk7XG4gICAgLy8gICAgIHZhciBkID0ganFvLm9mZnNldCgpO1xuICAgIC8vICAgICByZXR1cm4gdG9wID49IGQudG9wICYmIGxlZnQgPj0gZC5sZWZ0ICYmIGxlZnQgPD0gKGQubGVmdCtqcW9bMF0ub2Zmc2V0V2lkdGgpICYmIHRvcCA8PSAoZC50b3AranFvWzBdLm9mZnNldEhlaWdodCk7XG4gICAgLy8gfVxuXG4gICAgLy8gdG91Y2htb3ZlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAvLyAgICAgLy8gUHJldmVudCBzY3JvbGxpbmcgb24gdGhpcyBlbGVtZW50XG4gICAgLy8gICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgLy8gfVxuXG4gICAgLy8gJChcIi5jZWxsXCIpLmJpbmQoXCJtb3VzZWVudGVyIHRvdWNobW92ZVwiLCBmdW5jdGlvbihldnQpe1xuICAgIC8vICAgICBjb25zb2xlLmxvZygnYmluZGluZyBtb3VzZWVudGVyIGFuZCB0b3VjaG1vdmUnLCBldnQpO1xuICAgIC8vICAgICAkKFwiLmNlbGxcIikuZWFjaChmdW5jdGlvbigpIHtcbiAgICAvLyAgICAgICAgIGNvbnNvbGUubG9nKCdmb3IgZWFjaCBlbGVtZW50Jyk7XG4gICAgLy8gICAgICAgIGlmIChkaXZfb3ZlcmxhcCh0aGlzLCBldnQucGFnZVgsIGV2dC5wYWdlWSkpe1xuICAgIC8vICAgICAgICAgY29uc29sZS5sb2coJ2VudGVyaW5nIGRpdl9vdmVybGFwJyk7XG4gICAgLy8gICAgICAgICAgIGlmICghdGhpcy5oYXNDbGFzcygnc2VsZWN0ZWQnKSkge1xuICAgIC8vICAgICAgICAgICAgIHRoaXMuYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgLy8gICAgICAgICAgIH1cbiAgICAvLyAgICAgICAgfVxuICAgIC8vICAgICB9KTtcbiAgICAvLyB9KTtcblxuICAgIC8vIGFuZ3VsYXIuZWxlbWVudCgnLmNlbGwnKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uKGV2dCl7XG4gICAgLy8gICAgIGNvbnNvbGUubG9nKCdiaW5kaW5nIG1vdXNlZW50ZXIgYW5kIHRvdWNobW92ZScsIGV2dCk7XG4gICAgICAgIC8vICQoXCIuY2VsbFwiKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyAgICAgY29uc29sZS5sb2coJ2ZvciBlYWNoIGVsZW1lbnQnKTtcbiAgICAgICAgLy8gICAgaWYgKGRpdl9vdmVybGFwKHRoaXMsIGV2dC5wYWdlWCwgZXZ0LnBhZ2VZKSl7XG4gICAgICAgIC8vICAgICBjb25zb2xlLmxvZygnZW50ZXJpbmcgZGl2X292ZXJsYXAnKTtcbiAgICAgICAgLy8gICAgICAgaWYgKCF0aGlzLmhhc0NsYXNzKCdzZWxlY3RlZCcpKSB7XG4gICAgICAgIC8vICAgICAgICAgdGhpcy5hZGRDbGFzcygnc2VsZWN0ZWQnKTtcbiAgICAgICAgLy8gICAgICAgfVxuICAgICAgICAvLyAgICB9XG4gICAgICAgIC8vIH0pO1xuICAgIC8vIH0pO1xuXG4gICAgLy8gJGVsZW1lbnQuY2hpbGRyZW4oKShmdW5jdGlvbihldnQpe1xuICAgIC8vICAgICBjb25zb2xlLmxvZygnYmluZGluZyBtb3VzZWVudGVyIGFuZCB0b3VjaG1vdmUnLCBldnQpO1xuICAgICAgICAvLyAkKFwiLmNlbGxcIikuZWFjaChmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gICAgIGNvbnNvbGUubG9nKCdmb3IgZWFjaCBlbGVtZW50Jyk7XG4gICAgICAgIC8vICAgIGlmIChkaXZfb3ZlcmxhcCh0aGlzLCBldnQucGFnZVgsIGV2dC5wYWdlWSkpe1xuICAgICAgICAvLyAgICAgY29uc29sZS5sb2coJ2VudGVyaW5nIGRpdl9vdmVybGFwJyk7XG4gICAgICAgIC8vICAgICAgIGlmICghdGhpcy5oYXNDbGFzcygnc2VsZWN0ZWQnKSkge1xuICAgICAgICAvLyAgICAgICAgIHRoaXMuYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgICAgIC8vICAgICAgIH1cbiAgICAgICAgLy8gICAgfVxuICAgICAgICAvLyB9KTtcbiAgICAvLyB9KTtcblxuXG4gICAgLy8gJGVsZW1lbnQuYmluZChcInRvdWNobW92ZVwiLCBmdW5jdGlvbihldnQpe1xuICAgIC8vICAgICBjb25zb2xlLmxvZygnYmluZGluZyBtb3VzZWVudGVyIGFuZCB0b3VjaG1vdmUnLCBldnQpO1xuICAgIC8vICAgICAvLyAkKFwiLmNlbGxcIikuZWFjaChmdW5jdGlvbigpIHtcbiAgICAvLyAgICAgLy8gICAgIGNvbnNvbGUubG9nKCdmb3IgZWFjaCBlbGVtZW50Jyk7XG4gICAgLy8gICAgIC8vICAgIGlmIChkaXZfb3ZlcmxhcCh0aGlzLCBldnQucGFnZVgsIGV2dC5wYWdlWSkpe1xuICAgIC8vICAgICAvLyAgICAgY29uc29sZS5sb2coJ2VudGVyaW5nIGRpdl9vdmVybGFwJyk7XG4gICAgLy8gICAgIC8vICAgICAgIGlmICghdGhpcy5oYXNDbGFzcygnc2VsZWN0ZWQnKSkge1xuICAgIC8vICAgICAvLyAgICAgICAgIHRoaXMuYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgLy8gICAgIC8vICAgICAgIH1cbiAgICAvLyAgICAgLy8gICAgfVxuICAgIC8vICAgICAvLyB9KTtcbiAgICAvLyB9KTtcblxuICAgIC8vIGFuZ3VsYXIuZWxlbWVudCgnLmNlbGwnKS5iaW5kKFwidG91Y2htb3ZlXCIsIGZ1bmN0aW9uKGV2dCl7XG4gICAgLy8gICAgIGNvbnNvbGUubG9nKCdiaW5kaW5nIG1vdXNlZW50ZXIgYW5kIHRvdWNobW92ZScsIGV2dCk7XG4gICAgLy8gICAgIGFuZ3VsYXIuZWxlbWVudCgnLmNlbGwnKS5lYWNoKGZ1bmN0aW9uKCkge1xuICAgIC8vICAgICAgICAgY29uc29sZS5sb2coJ2ZvciBlYWNoIGVsZW1lbnQnKTtcbiAgICAvLyAgICAgICAgaWYgKGRpdl9vdmVybGFwKHRoaXMsIGV2dC5wYWdlWCwgZXZ0LnBhZ2VZKSl7XG4gICAgLy8gICAgICAgICBjb25zb2xlLmxvZygnZW50ZXJpbmcgZGl2X292ZXJsYXAnKTtcbiAgICAvLyAgICAgICAgICAgaWYgKCF0aGlzLmhhc0NsYXNzKCdzZWxlY3RlZCcpKSB7XG4gICAgLy8gICAgICAgICAgICAgdGhpcy5hZGRDbGFzcygnc2VsZWN0ZWQnKTtcbiAgICAvLyAgICAgICAgICAgfVxuICAgIC8vICAgICAgICB9XG4gICAgLy8gICAgIH0pO1xuICAgIC8vIH0pO1xuXG4gICAgJHNjb3BlLm1vYmlsZURyYWcgPSBmdW5jdGlvbihzcGFjZSwgaWQpe1xuICAgICAgICBjb25zb2xlLmxvZygndG91Y2ggaXMgZHJhZ2dlZDogJyArIHNwYWNlICsgXCIgOiBcIiArIGlkKTtcbiAgICAgICAgaWYoJHNjb3BlLnRvdWNoSXNBY3RpdmF0ZWQgJiYgJHNjb3BlLmRyYWdnaW5nQWxsb3dlZCl7XG4gICAgICAgICAgICAkc2NvcGUuY2xpY2soc3BhY2UsIGlkKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAkc2NvcGUuY2xpY2sgPSBmdW5jdGlvbihzcGFjZSwgaWQpIHtcbiAgICAgICAgaWYgKCRzY29wZS5mcmVlemUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zb2xlLmxvZygnY2xpY2tlZCAnLCBzcGFjZSwgaWQpO1xuICAgICAgICB2YXIgbHRyc1NlbGVjdGVkID0gT2JqZWN0LmtleXMoJHNjb3BlLmV4cG9ydHMud29yZE9iaik7XG4gICAgICAgIHZhciBwcmV2aW91c0x0ciA9IGx0cnNTZWxlY3RlZFtsdHJzU2VsZWN0ZWQubGVuZ3RoIC0gMl07XG4gICAgICAgIHZhciBsYXN0THRyID0gbHRyc1NlbGVjdGVkW2x0cnNTZWxlY3RlZC5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKCFsdHJzU2VsZWN0ZWQubGVuZ3RoIHx8IHZhbGlkU2VsZWN0KGlkLCBsdHJzU2VsZWN0ZWQpKSB7XG4gICAgICAgICAgICAkc2NvcGUuZXhwb3J0cy53b3JkICs9IHNwYWNlO1xuICAgICAgICAgICAgJHNjb3BlLmV4cG9ydHMud29yZE9ialtpZF0gPSBzcGFjZTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCRzY29wZS5leHBvcnRzKTtcbiAgICAgICAgfSBlbHNlIGlmIChpZCA9PT0gcHJldmlvdXNMdHIpIHtcbiAgICAgICAgICAgICRzY29wZS5leHBvcnRzLndvcmQgPSAkc2NvcGUuZXhwb3J0cy53b3JkLnN1YnN0cmluZygwLCAkc2NvcGUuZXhwb3J0cy53b3JkLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgZGVsZXRlICRzY29wZS5leHBvcnRzLndvcmRPYmpbbGFzdEx0cl07XG4gICAgICAgIH0gZWxzZSBpZiAobHRyc1NlbGVjdGVkLmxlbmd0aCA9PT0gMSAmJiBpZCA9PT0gbGFzdEx0cikge1xuICAgICAgICAgICAgJHNjb3BlLmV4cG9ydHMud29yZCA9IFwiXCI7XG4gICAgICAgICAgICBkZWxldGUgJHNjb3BlLmV4cG9ydHMud29yZE9ialtsYXN0THRyXTtcbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgIC8vZ2V0IHRoZSBjdXJyZW50IHJvb20gaW5mb1xuICAgIEJvYXJkRmFjdG9yeS5nZXRDdXJyZW50Um9vbSgkc3RhdGVQYXJhbXMucm9vbW5hbWUpXG4gICAgICAgIC50aGVuKHJvb20gPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2cocm9vbSlcbiAgICAgICAgICAgICRzY29wZS5nYW1lSWQgPSByb29tLmlkO1xuICAgICAgICAgICAgJHNjb3BlLm90aGVyUGxheWVycyA9IHJvb20udXNlcnMuZmlsdGVyKHVzZXIgPT4gdXNlci5pZCAhPT0gJHNjb3BlLnVzZXIuaWQpO1xuICAgICAgICAgICAgJHNjb3BlLm90aGVyUGxheWVycy5mb3JFYWNoKHBsYXllciA9PiB7IHBsYXllci5zY29yZSA9IDAgfSlcbiAgICAgICAgICAgIExvYmJ5RmFjdG9yeS5qb2luR2FtZShyb29tLmlkLCAkc2NvcGUudXNlci5pZCk7XG4gICAgICAgIH0pO1xuXG5cblxuICAgIC8vIFN0YXJ0IHRoZSBnYW1lIHdoZW4gYWxsIHBsYXllcnMgaGF2ZSBqb2luZWQgcm9vbVxuICAgICRzY29wZS5zdGFydEdhbWUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHVzZXJJZHMgPSAkc2NvcGUub3RoZXJQbGF5ZXJzLm1hcCh1c2VyID0+IHVzZXIuaWQpO1xuICAgICAgICB1c2VySWRzLnB1c2goJHNjb3BlLnVzZXIuaWQpO1xuICAgICAgICBjb25zb2xlLmxvZygnb3AnLCAkc2NvcGUub3RoZXJQbGF5ZXJzLCAndWknLCB1c2VySWRzKTtcbiAgICAgICAgJHNjb3BlLndpbk9yTG9zZSA9IG51bGw7XG4gICAgICAgIEJvYXJkRmFjdG9yeS5nZXRTdGFydEJvYXJkKCRzY29wZS5nYW1lTGVuZ3RoLCAkc2NvcGUuZ2FtZUlkLCB1c2VySWRzKTtcbiAgICB9O1xuXG5cbiAgICAvL1F1aXQgdGhlIHJvb20sIGJhY2sgdG8gbG9iYnlcbiAgICAkc2NvcGUucXVpdCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAkcm9vdFNjb3BlLmhpZGVOYXZiYXIgPSBmYWxzZTtcbiAgICAgICAgJHN0YXRlLmdvKCdsb2JieScpXG4gICAgfTtcblxuXG4gICAgLy9tYWtlcyBzdXJlIGxldHRlciBpcyBhZGphY2VudCB0byBwcmV2IGx0ciwgYW5kIGhhc24ndCBiZWVuIHVzZWQgeWV0XG4gICAgZnVuY3Rpb24gdmFsaWRTZWxlY3QobHRySWQsIG90aGVyTHRyc0lkcykge1xuICAgICAgICBpZiAob3RoZXJMdHJzSWRzLmluY2x1ZGVzKGx0cklkKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICB2YXIgY29vcmRzID0gbHRySWQuc3BsaXQoJy0nKTtcbiAgICAgICAgdmFyIHJvdyA9IGNvb3Jkc1swXTtcbiAgICAgICAgdmFyIGNvbCA9IGNvb3Jkc1sxXTtcbiAgICAgICAgdmFyIGxhc3RMdHJJZCA9IG90aGVyTHRyc0lkcy5wb3AoKTtcbiAgICAgICAgdmFyIGNvb3Jkc0xhc3QgPSBsYXN0THRySWQuc3BsaXQoJy0nKTtcbiAgICAgICAgdmFyIHJvd0xhc3QgPSBjb29yZHNMYXN0WzBdO1xuICAgICAgICB2YXIgY29sTGFzdCA9IGNvb3Jkc0xhc3RbMV07XG4gICAgICAgIHZhciByb3dPZmZzZXQgPSBNYXRoLmFicyhyb3cgLSByb3dMYXN0KTtcbiAgICAgICAgdmFyIGNvbE9mZnNldCA9IE1hdGguYWJzKGNvbCAtIGNvbExhc3QpO1xuICAgICAgICByZXR1cm4gKHJvd09mZnNldCA8PSAxICYmIGNvbE9mZnNldCA8PSAxKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbGVhcklmQ29uZmxpY3RpbmcodXBkYXRlV29yZE9iaiwgZXhwb3J0V29yZE9iaikge1xuICAgICAgICB2YXIgdGlsZXNNb3ZlZCA9IE9iamVjdC5rZXlzKHVwZGF0ZVdvcmRPYmopO1xuICAgICAgICB2YXIgbXlXb3JkVGlsZXMgPSBPYmplY3Qua2V5cyhleHBvcnRXb3JkT2JqKTtcbiAgICAgICAgaWYgKHRpbGVzTW92ZWQuc29tZShjb29yZCA9PiBteVdvcmRUaWxlcy5pbmNsdWRlcyhjb29yZCkpKSAkc2NvcGUuY2xlYXIoKTtcbiAgICB9XG5cbiAgICAkc2NvcGUuY2xlYXIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJHNjb3BlLmV4cG9ydHMud29yZCA9IFwiXCI7XG4gICAgICAgICRzY29wZS5leHBvcnRzLndvcmRPYmogPSB7fTtcbiAgICB9O1xuXG5cbiAgICAkc2NvcGUuc3VibWl0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdzdWJtaXR0aW5nICcsIG9iaik7XG4gICAgICAgIEJvYXJkRmFjdG9yeS5zdWJtaXQob2JqKTtcbiAgICAgICAgJHNjb3BlLmNsZWFyKCk7XG4gICAgfTtcblxuICAgICRzY29wZS5zaHVmZmxlID0gQm9hcmRGYWN0b3J5LnNodWZmbGU7XG5cblxuICAgICRzY29wZS51cGRhdGVCb2FyZCA9IGZ1bmN0aW9uKHdvcmRPYmopIHtcbiAgICAgICAgY29uc29sZS5sb2coJ3Njb3BlLmJvYXJkJywgJHNjb3BlLmJvYXJkKTtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIHdvcmRPYmopIHtcbiAgICAgICAgICAgIHZhciBjb29yZHMgPSBrZXkuc3BsaXQoJy0nKTtcbiAgICAgICAgICAgIHZhciByb3cgPSBjb29yZHNbMF07XG4gICAgICAgICAgICB2YXIgY29sID0gY29vcmRzWzFdO1xuICAgICAgICAgICAgJHNjb3BlLmJvYXJkW3Jvd11bY29sXSA9IHdvcmRPYmpba2V5XTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAkc2NvcGUudXBkYXRlU2NvcmUgPSBmdW5jdGlvbihwb2ludHMsIHBsYXllcklkKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCd1cGRhdGUgc2NvcmUgcG9pbnRzJywgcG9pbnRzKTtcbiAgICAgICAgaWYgKHBsYXllcklkID09PSAkc2NvcGUudXNlci5pZCkge1xuICAgICAgICAgICAgJHNjb3BlLnNjb3JlICs9IHBvaW50cztcbiAgICAgICAgICAgICRzY29wZS5leHBvcnRzLnBvaW50c0Vhcm5lZCA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHZhciBwbGF5ZXIgaW4gJHNjb3BlLm90aGVyUGxheWVycykge1xuICAgICAgICAgICAgICAgIGlmICgkc2NvcGUub3RoZXJQbGF5ZXJzW3BsYXllcl0uaWQgPT09IHBsYXllcklkKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZS5vdGhlclBsYXllcnNbcGxheWVyXS5zY29yZSArPSBwb2ludHM7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICRzY29wZS5leHBvcnRzLnBvaW50c0Vhcm5lZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG5cbiAgICAkc2NvcGUudXBkYXRlID0gZnVuY3Rpb24odXBkYXRlT2JqKSB7XG4gICAgICAgICRzY29wZS51cGRhdGVTY29yZSh1cGRhdGVPYmoucG9pbnRzRWFybmVkLCB1cGRhdGVPYmoucGxheWVySWQpO1xuICAgICAgICAkc2NvcGUudXBkYXRlQm9hcmQodXBkYXRlT2JqLndvcmRPYmopO1xuICAgICAgICBpZiAodXBkYXRlT2JqLndvcmQubGVuZ3RoID4gMyAmJiB1cGRhdGVPYmoucGxheWVySWQgIT0gJHNjb3BlLnVzZXIuaWQpIHtcbiAgICAgICAgICAgIGlmICghJHNjb3BlLmNyYWJkYW5jZXMpIGNyYWJkYW5jZSgpO1xuICAgICAgICAgICAgJHNjb3BlLmNyYWJkYW5jZXMrKztcbiAgICAgICAgfVxuICAgICAgICBpZiAoKyRzY29wZS51c2VyLmlkID09PSArdXBkYXRlT2JqLnBsYXllcklkKSB7XG4gICAgICAgICAgICB2YXIgcGxheWVyID0gJHNjb3BlLnVzZXIudXNlcm5hbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gJHNjb3BlLm90aGVyUGxheWVycykge1xuICAgICAgICAgICAgICAgIGlmICgrJHNjb3BlLm90aGVyUGxheWVyc1trZXldLmlkID09PSArdXBkYXRlT2JqLnBsYXllcklkKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwbGF5ZXIgPSAkc2NvcGUub3RoZXJQbGF5ZXJzW2tleV0udXNlcm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAkc2NvcGUubWVzc2FnZSA9IHBsYXllciArIFwiIHBsYXllZCBcIiArIHVwZGF0ZU9iai53b3JkICsgXCIgZm9yIFwiICsgdXBkYXRlT2JqLnBvaW50c0Vhcm5lZCArIFwiIHBvaW50cyFcIjtcbiAgICAgICAgaWYgKCRzY29wZS50aW1lb3V0KSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoJHNjb3BlLnRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgICAgICRzY29wZS50aW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICRzY29wZS5tZXNzYWdlID0gJyc7XG4gICAgICAgIH0sIDMwMDApO1xuICAgICAgICBjb25zb2xlLmxvZygnaXRzIHVwZGF0aW5nIScpO1xuICAgICAgICBjbGVhcklmQ29uZmxpY3RpbmcodXBkYXRlT2JqLCAkc2NvcGUuZXhwb3J0cy53b3JkT2JqKTtcbiAgICAgICAgJHNjb3BlLmV4cG9ydHMuc3RhdGVOdW1iZXIgPSB1cGRhdGVPYmouc3RhdGVOdW1iZXI7XG4gICAgICAgICRzY29wZS4kZXZhbEFzeW5jKCk7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGNyYWJkYW5jZSgpIHtcbiAgICAgICAgJHNjb3BlLmhpZGVCb2FyZCA9IHRydWU7XG4gICAgICAgICRzY29wZS5oaWRlQ3JhYmRhbmNlID0gZmFsc2U7XG4gICAgICAgIGNvbnNvbGUubG9nKCdkYW5jZSBjcmFiIScsICRzY29wZS5jcmFiZGFuY2VzKTtcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICRzY29wZS5jcmFiZGFuY2VzLS07XG4gICAgICAgICAgICBpZiAoJHNjb3BlLmNyYWJkYW5jZXMpIHtcbiAgICAgICAgICAgICAgICBjcmFiZGFuY2UoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICRzY29wZS5oaWRlQ3JhYmRhbmNlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAkc2NvcGUuaGlkZUJvYXJkID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIDMwMDApO1xuICAgIH1cblxuICAgICRzY29wZS5yZXBsYXkgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICBMb2JieUZhY3RvcnkubmV3R2FtZSh7IHJvb21uYW1lOiAkc2NvcGUucm9vbU5hbWUgfSlcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKGdhbWUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInJlcGxheSBnYW1lIG9iajpcIiwgZ2FtZSk7XG5cbiAgICAgICAgICAgICAgICAkc2NvcGUuZ2FtZUlkID0gZ2FtZS5pZDtcbiAgICAgICAgICAgICAgICAkc2NvcGUuc3RhcnRHYW1lKCk7XG4gICAgICAgICAgICAgICAgdmFyIGFsbElkcyA9ICRzY29wZS5vdGhlclBsYXllcnMubWFwKHBsYXllciA9PiBwbGF5ZXIuaWQpO1xuICAgICAgICAgICAgICAgIGFsbElkcy5wdXNoKCRzY29wZS51c2VyLmlkKTtcbiAgICAgICAgICAgICAgICAkcS5hbGwoYWxsSWRzLm1hcChpZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIExvYmJ5RmFjdG9yeS5qb2luR2FtZSgkc2NvcGUuZ2FtZUlkLCBpZCk7XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignZXJyb3IgcmVzdGFydGluZyB0aGUgZ2FtZScsIGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgfTtcblxuICAgICRzY29wZS5kZXRlcm1pbmVXaW5uZXIgPSBmdW5jdGlvbih3aW5uZXJzQXJyYXkpIHtcbiAgICAgICAgaWYgKHdpbm5lcnNBcnJheS5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGlmICgrd2lubmVyc0FycmF5WzBdID09PSArJHNjb3BlLnVzZXIuaWQpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUud2luT3JMb3NlID0gXCJDb25ncmF0dWxhdGlvbiEgWW91IGFyZSBhIHdvcmQgd2l6YXJkISBZb3Ugd29uISEhXCI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIHBsYXllciBpbiAkc2NvcGUub3RoZXJQbGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICgrJHNjb3BlLm90aGVyUGxheWVyc1twbGF5ZXJdLmlkID09PSArd2lubmVyc0FycmF5WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgd2lubmVyID0gJHNjb3BlLm90aGVyUGxheWVyc1twbGF5ZXJdLnVzZXJuYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgJHNjb3BlLndpbk9yTG9zZSA9IFwiVG91Z2ggbHVjay4gXCIgKyB3aW5uZXIgKyBcIiBoYXMgYmVhdGVuIHlvdS4gQmV0dGVyIEx1Y2sgbmV4dCB0aW1lLiA6KFwiXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgd2lubmVycyA9IFtdO1xuICAgICAgICAgICAgZm9yICh2YXIgaSBpbiB3aW5uZXJzQXJyYXkpIHtcbiAgICAgICAgICAgICAgICBpZiAoK3dpbm5lcnNBcnJheVtpXSA9PT0gKyRzY29wZS51c2VyLmlkKSB7IHdpbm5lcnMucHVzaCgkc2NvcGUudXNlci51c2VybmFtZSk7IH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAodmFyIHBsYXllciBpbiAkc2NvcGUub3RoZXJQbGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoJHNjb3BlLm90aGVyUGxheWVyc1twbGF5ZXJdLmlkID09IHdpbm5lcnNBcnJheVtpXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbm5lcnMucHVzaCgkc2NvcGUub3RoZXJQbGF5ZXJzW3BsYXllcl0udXNlcm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHdpbm5lcnMpO1xuICAgICAgICAgICAgICAgICRzY29wZS53aW5Pckxvc2UgPSBcIlRoZSBnYW1lIHdhcyBhIHRpZSBiZXR3ZWVuIFwiO1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgd2lubmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PT0gd2lubmVycy5sZW5ndGggLSAxKSB7ICRzY29wZS53aW5Pckxvc2UgKz0gXCJhbmQgXCIgKyB3aW5uZXJzW2ldICsgXCIuXCI7IH0gZWxzZSB7ICRzY29wZS53aW5Pckxvc2UgKz0gd2lubmVyc1tpXSArIFwiLCBcIjsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgJHNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2Rlc3Ryb3llZCcpO1xuICAgICAgICBTb2NrZXQuZGlzY29ubmVjdCgpO1xuXG4gICAgfSk7XG5cbiAgICBTb2NrZXQub24oJ2Nvbm5lY3QnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ2Nvbm5lY3RpbmcnKTtcbiAgICAgICAgJHEuYWxsKFtcbiAgICAgICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3VzZXIgZnJvbSBBdXRoU2VydmljZScsIHVzZXIpO1xuICAgICAgICAgICAgICAgICRzY29wZS51c2VyID0gdXNlcjtcbiAgICAgICAgICAgICAgICAkc2NvcGUuZXhwb3J0cy5wbGF5ZXJJZCA9IHVzZXIuaWQ7XG4gICAgICAgICAgICB9KSxcblxuICAgICAgICAgICAgLy9nZXQgdGhlIGN1cnJlbnQgcm9vbSBpbmZvXG4gICAgICAgICAgICBCb2FyZEZhY3RvcnkuZ2V0Q3VycmVudFJvb20oJHN0YXRlUGFyYW1zLnJvb21uYW1lKVxuICAgICAgICAgICAgLnRoZW4ocm9vbSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cocm9vbSk7XG4gICAgICAgICAgICAgICAgJHNjb3BlLmdhbWVJZCA9IHJvb20uaWQ7XG4gICAgICAgICAgICAgICAgJHNjb3BlLm90aGVyUGxheWVycyA9IHJvb20udXNlcnMuZmlsdGVyKHVzZXIgPT4gdXNlci5pZCAhPT0gJHNjb3BlLnVzZXIuaWQpO1xuICAgICAgICAgICAgICAgICRzY29wZS5vdGhlclBsYXllcnMuZm9yRWFjaChwbGF5ZXIgPT4geyBwbGF5ZXIuc2NvcmUgPSAwIH0pO1xuICAgICAgICAgICAgICAgIExvYmJ5RmFjdG9yeS5qb2luR2FtZShyb29tLmlkLCAkc2NvcGUudXNlci5pZCk7XG4gICAgICAgICAgICB9KVxuICAgICAgICBdKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgU29ja2V0LmVtaXQoJ2pvaW5Sb29tJywgJHNjb3BlLnVzZXIsICRzY29wZS5yb29tTmFtZSwgJHNjb3BlLmdhbWVJZCk7XG4gICAgICAgICAgICAkc2NvcGUuaGlkZVN0YXJ0ID0gZmFsc2U7XG4gICAgICAgICAgICAkc2NvcGUuJGV2YWxBc3luYygpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2VtaXR0aW5nIFwiam9pbiByb29tXCIgZXZlbnQgdG8gc2VydmVyIDhQJywgJHNjb3BlLnJvb21OYW1lKTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignZXJyb3IgZ3JhYmJpbmcgdXNlciBvciByb29tIGZyb20gZGI6ICcsIGUpO1xuICAgICAgICB9KTtcblxuXG4gICAgICAgIFNvY2tldC5vbigncm9vbUpvaW5TdWNjZXNzJywgZnVuY3Rpb24odXNlcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ25ldyB1c2VyIGpvaW5pbmcnLCB1c2VyLmlkKTtcbiAgICAgICAgICAgIHVzZXIuc2NvcmUgPSAwO1xuICAgICAgICAgICAgJHNjb3BlLm90aGVyUGxheWVycy5wdXNoKHVzZXIpO1xuICAgICAgICAgICAgJHNjb3BlLiRldmFsQXN5bmMoKTtcblxuICAgICAgICB9KTtcblxuICAgICAgICBTb2NrZXQub24oJ3N0YXJ0Qm9hcmQnLCBmdW5jdGlvbihib2FyZCkge1xuICAgICAgICAgICAgJHNjb3BlLmZyZWV6ZSA9IGZhbHNlO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2JvYXJkISAnLCBib2FyZCk7XG4gICAgICAgICAgICAkc2NvcGUuYm9hcmQgPSBib2FyZDtcbiAgICAgICAgICAgICRzY29wZS5vdGhlclBsYXllcnMuZm9yRWFjaChwbGF5ZXIgPT4geyBwbGF5ZXIuc2NvcmUgPSAwIH0pO1xuICAgICAgICAgICAgJHNjb3BlLnNjb3JlID0gMDtcbiAgICAgICAgICAgICRzY29wZS5oaWRlU3RhcnQgPSB0cnVlO1xuICAgICAgICAgICAgJHNjb3BlLmhpZGVCb2FyZCA9IGZhbHNlO1xuICAgICAgICAgICAgJHNjb3BlLiRldmFsQXN5bmMoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgU29ja2V0Lm9uKCd3b3JkVmFsaWRhdGVkJywgZnVuY3Rpb24odXBkYXRlT2JqKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnd29yZCBpcyB2YWxpZGF0ZWQnKTtcbiAgICAgICAgICAgICRzY29wZS51cGRhdGUodXBkYXRlT2JqKTtcbiAgICAgICAgICAgICRzY29wZS5sYXN0V29yZFBsYXllZCA9IHVwZGF0ZU9iai53b3JkO1xuICAgICAgICAgICAgJHNjb3BlLiRldmFsQXN5bmMoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgU29ja2V0Lm9uKCdib2FyZFNodWZmbGVkJywgZnVuY3Rpb24oYm9hcmQsIHVzZXJJZCwgc3RhdGVOdW1iZXIpIHtcbiAgICAgICAgICAgICRzY29wZS5ib2FyZCA9IGJvYXJkO1xuICAgICAgICAgICAgJHNjb3BlLnVwZGF0ZVNjb3JlKC01LCB1c2VySWQpO1xuICAgICAgICAgICAgJHNjb3BlLmNsZWFyKCk7XG4gICAgICAgICAgICAkc2NvcGUuZXhwb3J0cy5zdGF0ZU51bWJlciA9IHN0YXRlTnVtYmVyO1xuICAgICAgICAgICAgJHNjb3BlLm1lc3NhZ2UgPSB1c2VySWQgKyBcIiBzaHVmZmxlZCB0aGUgYm9hcmQhXCI7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygkc2NvcGUubWVzc2FnZSk7XG4gICAgICAgICAgICAkc2NvcGUuJGV2YWxBc3luYygpO1xuICAgICAgICB9KTtcblxuICAgICAgICBTb2NrZXQub24oJ3BsYXllckRpc2Nvbm5lY3RlZCcsIGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdwbGF5ZXJEaXNjb25uZWN0ZWQnLCB1c2VyLmlkKTtcbiAgICAgICAgICAgICRzY29wZS5vdGhlclBsYXllcnMgPSAkc2NvcGUub3RoZXJQbGF5ZXJzLm1hcChvdGhlclBsYXllcnMgPT4gb3RoZXJQbGF5ZXJzLmlkICE9PSB1c2VyLmlkKTtcblxuICAgICAgICAgICAgJHNjb3BlLiRldmFsQXN5bmMoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgU29ja2V0Lm9uKCdnYW1lT3ZlcicsIGZ1bmN0aW9uKHdpbm5lcnNBcnJheSkge1xuICAgICAgICAgICAgJHNjb3BlLmNsZWFyKCk7XG4gICAgICAgICAgICAkc2NvcGUuZnJlZXplID0gdHJ1ZTtcbiAgICAgICAgICAgICRzY29wZS5kZXRlcm1pbmVXaW5uZXIod2lubmVyc0FycmF5KTtcbiAgICAgICAgICAgICRzY29wZS4kZXZhbEFzeW5jKCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnZ2FtZSBpcyBvdmVyLCB3aW5uZXJzOiAnLCB3aW5uZXJzQXJyYXkpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn0pO1xuIiwiYXBwLmZhY3RvcnkgKFwiQm9hcmRGYWN0b3J5XCIsIGZ1bmN0aW9uKCRodHRwLCBTb2NrZXQpe1xuXHRyZXR1cm57XG5cdFx0Z2V0U3RhcnRCb2FyZDogZnVuY3Rpb24oZ2FtZUxlbmd0aCwgZ2FtZUlkLCB1c2VySWRzKXtcblx0XHRcdGNvbnNvbGUubG9nKCdmYWN0b3J5LiBnbDogJywgZ2FtZUxlbmd0aCk7XG5cdFx0XHRTb2NrZXQuZW1pdCgnZ2V0U3RhcnRCb2FyZCcsIGdhbWVMZW5ndGgsIGdhbWVJZCwgdXNlcklkcyk7XG5cdFx0fSxcblxuXHRcdHN1Ym1pdDogZnVuY3Rpb24ob2JqKXtcblx0XHRcdFNvY2tldC5lbWl0KCdzdWJtaXRXb3JkJywgb2JqKTtcblx0XHR9LFxuXG5cdFx0c2h1ZmZsZTogZnVuY3Rpb24odXNlcil7XG5cdFx0XHRjb25zb2xlLmxvZygnZ3JpZGZhY3RvcnkgdScsdXNlci5pZCk7XG5cdFx0XHRTb2NrZXQuZW1pdCgnc2h1ZmZsZUJvYXJkJyx1c2VyLmlkKTtcblx0XHR9LFxuXG5cdFx0Ly8gZmluZEFsbE90aGVyVXNlcnM6IGZ1bmN0aW9uKGdhbWUpIHtcblx0XHQvLyBcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvZ2FtZXMvJysgZ2FtZS5pZClcblx0XHQvLyBcdC50aGVuKHJlcyA9PiByZXMuZGF0YSlcblx0XHQvLyB9LFxuXG5cdFx0Z2V0Q3VycmVudFJvb206IGZ1bmN0aW9uKHJvb21uYW1lKSB7XG5cdFx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL2dhbWVzL3Jvb21zLycrcm9vbW5hbWUpXG5cdFx0XHQudGhlbihyZXMgPT4gcmVzLmRhdGEpXG5cdFx0fSxcblxuXHRcdHF1aXRGcm9tUm9vbTogZnVuY3Rpb24oZ2FtZUlkLCB1c2VySWQpIHtcblx0XHRcdC8vIFNvY2tldC5lbWl0KCdkaXNjb25uZWN0Jywgcm9vbU5hbWUsIHVzZXJJZCk7XG5cdFx0XHRyZXR1cm4gJGh0dHAuZGVsZXRlKCcvYXBpL2dhbWVzLycrZ2FtZUlkKycvJyt1c2VySWQpXG5cdFx0fVxuXHR9XG59KTtcbiIsImFwcC5jb250cm9sbGVyKCdIb21lQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlLCAkbG9jYXRpb24pe1xuICAkc2NvcGUuZW50ZXJMb2JieSA9IGZ1bmN0aW9uKCl7XG4gICAgJHN0YXRlLmdvKCdsb2JieScsIHtyZWxvYWQ6IHRydWV9KTtcbiAgfVxufSk7XG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2hvbWUnLCB7XG4gICAgICAgIHVybDogJy8nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2hvbWUvaG9tZS5odG1sJ1xuICAgIH0pO1xufSk7XG5cbiIsImFwcC5jb250cm9sbGVyKCdMZWFkZXJCb2FyZEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIExlYWRlckJvYXJkRmFjdG9yeSwgJHN0YXRlLCBBdXRoU2VydmljZSkge1xuICAgIGNvbnNvbGUubG9nKCcgMScpXG4gICAgTGVhZGVyQm9hcmRGYWN0b3J5LkFsbFBsYXllcnMoKVxuICAgIC50aGVuKHBsYXllcnMgPT4ge1xuICAgICAgICBwbGF5ZXJzLmZvckVhY2gocGxheWVyID0+IHtcbiAgICAgICAgICAgIGlmIChwbGF5ZXIuZ2FtZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHZhciBzY29yZXMgPSBwbGF5ZXIuZ2FtZXMubWFwKGdhbWUgPT4gZ2FtZS51c2VyR2FtZS5zY29yZSlcbiAgICAgICAgICAgICAgICBwbGF5ZXIuaGlnaGVzdFNjb3JlID0gTWF0aC5tYXgoLi4uc2NvcmVzKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwbGF5ZXIuaGlnaGVzdFNjb3JlID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBsYXllci5nYW1lc193b24gPSBwbGF5ZXIud2lubmVyLmxlbmd0aDtcbiAgICAgICAgICAgIHBsYXllci5nYW1lc19wbGF5ZWQgPSBwbGF5ZXIuZ2FtZXMubGVuZ3RoO1xuICAgICAgICAgICAgaWYocGxheWVyLmdhbWVzLmxlbmd0aD09PTApe1xuICAgICAgICAgICAgXHRwbGF5ZXIud2luX3BlcmNlbnRhZ2UgPSAwICsgJyUnXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXHRwbGF5ZXIud2luX3BlcmNlbnRhZ2UgPSAoKHBsYXllci53aW5uZXIubGVuZ3RoL3BsYXllci5nYW1lcy5sZW5ndGgpKjEwMCkudG9GaXhlZCgwKSArICclJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KVxuICAgICAgICAkc2NvcGUucGxheWVycyA9IHBsYXllcnM7XG4gICAgfSlcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ0xlYWRlckJvYXJkRmFjdG9yeScsIGZ1bmN0aW9uICgkaHR0cCkge1xuXHR2YXIgTGVhZGVyQm9hcmRGYWN0b3J5ID0ge307XG5cblx0TGVhZGVyQm9hcmRGYWN0b3J5LkFsbFBsYXllcnMgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3VzZXJzJylcblx0XHQudGhlbihyZXM9PnJlcy5kYXRhKVxuXHR9XG5cblx0cmV0dXJuIExlYWRlckJvYXJkRmFjdG9yeTtcbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsZWFkZXJCb2FyZCcsIHtcbiAgICAgICAgdXJsOiAnL2xlYWRlckJvYXJkJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sZWFkZXJCb2FyZC9sZWFkZXJCb2FyZC50ZW1wbGF0ZS5odG1sJyxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICBcdGFsbFBsYXllcnM6IGZ1bmN0aW9uKExlYWRlckJvYXJkRmFjdG9yeSkge1xuICAgICAgICBcdFx0cmV0dXJuIExlYWRlckJvYXJkRmFjdG9yeS5BbGxQbGF5ZXJzO1xuICAgICAgICBcdH0sXG4gICAgICAgICAgICBcbiAgICAgICAgfSxcbiAgICAgICAgY29udHJvbGxlcjogJ0xlYWRlckJvYXJkQ3RybCdcbiAgICB9KTtcblxufSk7IiwiYXBwLmRpcmVjdGl2ZSgnbGV0dGVyJywgKCkgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHNjb3BlOiB7XG4gICAgICAgICAgICBzcGFjZTogJz0nLFxuICAgICAgICAgICAgeDogJz0nLFxuICAgICAgICAgICAgeTogJz0nLFxuICAgICAgICAgICAgZHJhZ2dpbmdBbGxvd2VkOiAnPScsXG4gICAgICAgICAgICBleHBvcnRzOiAnPSdcbiAgICAgICAgfSxcbiAgICAgICAgbGluazogZnVuY3Rpb24oc2NvcGUsIGVsLCBhdHRyKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coJ3Njb3BlLmRyYWdnaW5nQWxsb3dlZDogJyArIHNjb3BlLmRyYWdnaW5nQWxsb3dlZCk7XG5cbiAgICAgICAgICAgIHNjb3BlLm1vdXNlSXNEb3duID0gZmFsc2U7XG4gICAgICAgICAgICBzY29wZS50b3VjaElzQWN0aXZhdGVkID0gZmFsc2U7XG5cblxuICAgICAgICAgICAgc2NvcGUubW91c2VEb3duID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ21vdXNlIGlzIGRvd24nKVxuICAgICAgICAgICAgICAgIHNjb3BlLm1vdXNlSXNEb3duID0gdHJ1ZTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjb3BlLm1vdXNlVXAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnbW91c2UgaXMgdXAnKTtcbiAgICAgICAgICAgICAgICBzY29wZS5tb3VzZUlzRG93biA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmIChzY29wZS5kcmFnZ2luZ0FsbG93ZWQgJiYgc2NvcGUuZXhwb3J0cy53b3JkLmxlbmd0aCA+IDEpIHNjb3BlLnN1Ym1pdChzY29wZS5leHBvcnRzKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjb3BlLnRvdWNoQWN0aXZhdGVkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3RvdWNoIGlzIGFjdGl2YXRlZDogJyArIGFyZ3VtZW50cyk7XG4gICAgICAgICAgICAgICAgc2NvcGUudG91Y2hJc0FjdGl2YXRlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjb3BlLnRvdWNoU3RvcHBlZCA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygndG91Y2ggaXMgc3RvcHBlZDogJyArIGUpO1xuICAgICAgICAgICAgICAgIHNjb3BlLnRvdWNoSXNBY3RpdmF0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpZiAoc2NvcGUuZHJhZ2dpbmdBbGxvd2VkICYmIHNjb3BlLmV4cG9ydHMud29yZC5sZW5ndGggPiAxKSBzY29wZS5zdWJtaXQoc2NvcGUuZXhwb3J0cyk7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgc2NvcGUuZHJhZyA9IGZ1bmN0aW9uKHNwYWNlLCBpZCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdtb3VzZSBlbnRlcjogJyArIGlkKTtcbiAgICAgICAgICAgICAgICBpZiAoc2NvcGUubW91c2VJc0Rvd24gJiYgc2NvcGUuZHJhZ2dpbmdBbGxvd2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLmNsaWNrKHNwYWNlLCBpZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gdmFsaWRTZWxlY3QobHRySWQsIG90aGVyTHRyc0lkcykge1xuICAgICAgICAgICAgICAgIGlmIChvdGhlckx0cnNJZHMuaW5jbHVkZXMobHRySWQpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgdmFyIGNvb3JkcyA9IGx0cklkLnNwbGl0KCctJyk7XG4gICAgICAgICAgICAgICAgdmFyIHJvdyA9IGNvb3Jkc1swXTtcbiAgICAgICAgICAgICAgICB2YXIgY29sID0gY29vcmRzWzFdO1xuICAgICAgICAgICAgICAgIHZhciBsYXN0THRySWQgPSBvdGhlckx0cnNJZHMucG9wKCk7XG4gICAgICAgICAgICAgICAgdmFyIGNvb3Jkc0xhc3QgPSBsYXN0THRySWQuc3BsaXQoJy0nKTtcbiAgICAgICAgICAgICAgICB2YXIgcm93TGFzdCA9IGNvb3Jkc0xhc3RbMF07XG4gICAgICAgICAgICAgICAgdmFyIGNvbExhc3QgPSBjb29yZHNMYXN0WzFdO1xuICAgICAgICAgICAgICAgIHZhciByb3dPZmZzZXQgPSBNYXRoLmFicyhyb3cgLSByb3dMYXN0KTtcbiAgICAgICAgICAgICAgICB2YXIgY29sT2Zmc2V0ID0gTWF0aC5hYnMoY29sIC0gY29sTGFzdCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChyb3dPZmZzZXQgPD0gMSAmJiBjb2xPZmZzZXQgPD0gMSk7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICAgICAgc2NvcGUuY2xpY2sgPSBmdW5jdGlvbihzcGFjZSwgaWQpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NvcGUuZnJlZXplKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2NsaWNrZWQgJywgc3BhY2UsIGlkKTtcbiAgICAgICAgICAgICAgICB2YXIgbHRyc1NlbGVjdGVkID0gT2JqZWN0LmtleXMoc2NvcGUuZXhwb3J0cy53b3JkT2JqKTtcbiAgICAgICAgICAgICAgICB2YXIgcHJldmlvdXNMdHIgPSBsdHJzU2VsZWN0ZWRbbHRyc1NlbGVjdGVkLmxlbmd0aCAtIDJdO1xuICAgICAgICAgICAgICAgIHZhciBsYXN0THRyID0gbHRyc1NlbGVjdGVkW2x0cnNTZWxlY3RlZC5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICBpZiAoIWx0cnNTZWxlY3RlZC5sZW5ndGggfHwgdmFsaWRTZWxlY3QoaWQsIGx0cnNTZWxlY3RlZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUuZXhwb3J0cy53b3JkICs9IHNwYWNlO1xuICAgICAgICAgICAgICAgICAgICBzY29wZS5leHBvcnRzLndvcmRPYmpbaWRdID0gc3BhY2U7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHNjb3BlLmV4cG9ydHMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaWQgPT09IHByZXZpb3VzTHRyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLmV4cG9ydHMud29yZCA9IHNjb3BlLmV4cG9ydHMud29yZC5zdWJzdHJpbmcoMCwgc2NvcGUuZXhwb3J0cy53b3JkLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc2NvcGUuZXhwb3J0cy53b3JkT2JqW2xhc3RMdHJdO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobHRyc1NlbGVjdGVkLmxlbmd0aCA9PT0gMSAmJiBpZCA9PT0gbGFzdEx0cikge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS5leHBvcnRzLndvcmQgPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc2NvcGUuZXhwb3J0cy53b3JkT2JqW2xhc3RMdHJdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGRpdl9vdmVybGFwKGpxbywgbGVmdCwgdG9wKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2RpdiBvdmVybGFwcGVkOiAnICsganFvKTtcbiAgICAgICAgICAgICAgICB2YXIgZCA9IGpxby5vZmZzZXQoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9wID49IGQudG9wICYmIGxlZnQgPj0gZC5sZWZ0ICYmIGxlZnQgPD0gKGQubGVmdCtqcW9bMF0ub2Zmc2V0V2lkdGgpICYmIHRvcCA8PSAoZC50b3AranFvWzBdLm9mZnNldEhlaWdodCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGVsLmJpbmQoXCJ0b3VjaG1vdmVcIiwgZnVuY3Rpb24oZXZ0KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2JpbmRpbmcgbW91c2VlbnRlciBhbmQgdG91Y2htb3ZlJywgZXZ0KTtcbiAgICAgICAgICAgICAgICBlbC5lYWNoKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZm9yIGVhY2ggZWxlbWVudCcpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZGl2X292ZXJsYXAodGhpcywgZXZ0LnBhZ2VYLCBldnQucGFnZVkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnZW50ZXJpbmcgZGl2X292ZXJsYXAnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNDbGFzcygnc2VsZWN0ZWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkQ2xhc3MoJ3NlbGVjdGVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIC8vIHNjb3BlLm1vYmlsZURyYWcgPSBmdW5jdGlvbihzcGFjZSwgaWQpIHtcbiAgICAgICAgICAgIC8vICAgICBjb25zb2xlLmxvZygndG91Y2ggaXMgZHJhZ2dlZDogJyArIHNwYWNlICsgXCIgOiBcIiArIGlkKTtcbiAgICAgICAgICAgIC8vICAgICBpZigkc2NvcGUudG91Y2hJc0FjdGl2YXRlZCAmJiAkc2NvcGUuZHJhZ2dpbmdBbGxvd2VkKXtcbiAgICAgICAgICAgIC8vICAgICAgICAgJHNjb3BlLmNsaWNrKHNwYWNlLCBpZCk7XG4gICAgICAgICAgICAvLyAgICAgfVxuICAgICAgICAgICAgLy8gfTtcblxuXG5cbiAgICAgICAgfSxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICcvanMvbGV0dGVyL2xldHRlci50ZW1wbGF0ZS5odG1sJ1xuICAgIH1cbn0pO1xuIiwiYXBwLmNvbnRyb2xsZXIoJ0xvYmJ5Q3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgTG9iYnlGYWN0b3J5LCByb29tcywgJHN0YXRlLCBBdXRoU2VydmljZSkge1xuXG4gICAgLy8gQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAvLyAgICAgLnRoZW4oZnVuY3Rpb24odXNlcikge1xuICAgIC8vICAgICAgICAgJHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgIC8vICAgICB9KTtcblxuICAgICRzY29wZS5yb29tcyA9IHJvb21zO1xuICAgICRzY29wZS5yb29tTmFtZUZvcm0gPSBmYWxzZTtcbiAgICAvLyAkc2NvcGUudXNlciA9IHtcbiAgICAvLyAgaWQ6IDNcbiAgICAvLyB9XG5cbiAgICAvLyAkc2NvcGUuam9pbkdhbWUgPSBmdW5jdGlvbihyb29tKSB7XG4gICAgLy8gICAgIGNvbnNvbGUubG9nKFwiaW0gY2hhbmdpbmcgc3RhdGUgYW5kIHJlbG9hZGluZ1wiKTtcbiAgICAvLyAgICAgJHN0YXRlLmdvKCdHYW1lJywgeyByb29tbmFtZTogcm9vbS5yb29tbmFtZSB9LCB7IHJlbG9hZDogdHJ1ZSwgbm90aWZ5OiB0cnVlIH0pXG4gICAgLy8gfTtcblxuICAgICRzY29wZS5uZXdSb29tID0gZnVuY3Rpb24ocm9vbUluZm8pIHtcbiAgICAgICAgTG9iYnlGYWN0b3J5Lm5ld0dhbWUocm9vbUluZm8pO1xuICAgICAgICAkc2NvcGUucm9vbU5hbWVGb3JtID0gZmFsc2U7XG4gICAgfTtcbiAgICAkc2NvcGUuc2hvd0Zvcm0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJHNjb3BlLnJvb21OYW1lRm9ybSA9IHRydWU7XG4gICAgfTtcblxufSk7XG4iLCJhcHAuZGlyZWN0aXZlKCdlbnRlckxvYmJ5JywgZnVuY3Rpb24oKXtcbiAgcmV0dXJuIHtcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvbG9iYnkvbG9iYnktYnV0dG9uLmh0bWwnLFxuICAgIGNvbnRyb2xsZXI6ICdIb21lQ3RybCdcbiAgfVxufSlcbiIsImFwcC5mYWN0b3J5KCdMb2JieUZhY3RvcnknLCBmdW5jdGlvbiAoJGh0dHApIHtcblx0dmFyIExvYmJ5RmFjdG9yeSA9IHt9O1xuXHR2YXIgdGVtcFJvb21zID0gW107IC8vd29yayB3aXRoIHNvY2tldD9cblxuXHRMb2JieUZhY3RvcnkuZ2V0QWxsUm9vbXMgPSBmdW5jdGlvbigpe1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvZ2FtZXMvcm9vbXMnKVxuXHRcdC50aGVuKHJlcyA9PiByZXMuZGF0YSlcblx0XHQudGhlbihyb29tcyA9PiB7XG5cdFx0XHRhbmd1bGFyLmNvcHkocm9vbXMsIHRlbXBSb29tcyk7XG5cdFx0XHRyZXR1cm4gdGVtcFJvb21zO1xuXHRcdH0pXG5cdH07XG5cblx0TG9iYnlGYWN0b3J5LmpvaW5HYW1lID0gZnVuY3Rpb24ocm9vbUlkLCB1c2VySWQpIHtcbiAgICBjb25zb2xlLmxvZygnbG9iYnkgZmFjdG9yeSBqb2luIGdhbWUnKTtcblx0XHRyZXR1cm4gJGh0dHAucHV0KCcvYXBpL2dhbWVzLycrIHJvb21JZCArJy9wbGF5ZXInLCB7aWQ6IHVzZXJJZH0pXG5cdFx0LnRoZW4ocmVzPT5yZXMuZGF0YSlcblx0fTtcblxuXHRMb2JieUZhY3RvcnkubmV3R2FtZSA9IGZ1bmN0aW9uKHJvb21JbmZvKSB7XG5cdFx0cmV0dXJuICRodHRwLnB1dCgnL2FwaS9nYW1lcycsIHJvb21JbmZvKVxuXHRcdC50aGVuKHJlcyA9PiByZXMuZGF0YSlcblx0IFx0LnRoZW4ocm9vbSA9PiB7XG5cdCBcdFx0dGVtcFJvb21zLnB1c2gocm9vbSk7XG5cdCBcdFx0cmV0dXJuIHJvb207XG5cdCBcdFx0fSk7XG5cdH07XG5cblx0TG9iYnlGYWN0b3J5LkFsbFBsYXllcnMgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3VzZXJzJylcblx0XHQudGhlbihyZXM9PnJlcy5kYXRhKVxuXHR9O1xuXG5cdHJldHVybiBMb2JieUZhY3Rvcnk7XG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbG9iYnknLCB7XG4gICAgICAgIHVybDogJy9sb2JieScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbG9iYnkvbG9iYnkudGVtcGxhdGUuaHRtbCcsXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgXHRyb29tczogZnVuY3Rpb24oTG9iYnlGYWN0b3J5KSB7XG4gICAgICAgIFx0XHRyZXR1cm4gTG9iYnlGYWN0b3J5LmdldEFsbFJvb21zKCk7XG4gICAgICAgIFx0fVxuICAgICAgICB9LFxuICAgICAgICBjb250cm9sbGVyOiAnTG9iYnlDdHJsJ1xuICAgIH0pO1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xvZ2luJywge1xuICAgICAgICB1cmw6ICcvbG9naW4nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2xvZ2luL2xvZ2luLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnTG9naW5DdHJsJ1xuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAkc2NvcGUuc2VuZExvZ2luID0gZnVuY3Rpb24gKGxvZ2luSW5mbykge1xuXG4gICAgICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UubG9naW4obG9naW5JbmZvKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzdGF0ZS5nbygnaG9tZScpO1xuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nO1xuICAgICAgICB9KTtcblxuICAgIH07XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtZW1iZXJzT25seScsIHtcbiAgICAgICAgdXJsOiAnL21lbWJlcnMtYXJlYScsXG4gICAgICAgIHRlbXBsYXRlOiAnPGltZyBuZy1yZXBlYXQ9XCJpdGVtIGluIHN0YXNoXCIgd2lkdGg9XCIzMDBcIiBuZy1zcmM9XCJ7eyBpdGVtIH19XCIgLz4nLFxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbiAoJHNjb3BlLCBTZWNyZXRTdGFzaCkge1xuICAgICAgICAgICAgU2VjcmV0U3Rhc2guZ2V0U3Rhc2goKS50aGVuKGZ1bmN0aW9uIChzdGFzaCkge1xuICAgICAgICAgICAgICAgICRzY29wZS5zdGFzaCA9IHN0YXNoO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgZGF0YS5hdXRoZW50aWNhdGUgaXMgcmVhZCBieSBhbiBldmVudCBsaXN0ZW5lclxuICAgICAgICAvLyB0aGF0IGNvbnRyb2xzIGFjY2VzcyB0byB0aGlzIHN0YXRlLiBSZWZlciB0byBhcHAuanMuXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIGF1dGhlbnRpY2F0ZTogdHJ1ZVxuICAgICAgICB9XG4gICAgfSk7XG5cbn0pO1xuXG4iLCJhcHAuZGlyZWN0aXZlKCdyYW5rRGlyZWN0aXZlJywgKCk9PiB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFJyxcblx0XHRzY29wZToge1xuXHRcdFx0cmFua05hbWU6ICdAJyxcblx0XHRcdHBsYXllcnM6ICc9Jyxcblx0XHRcdHJhbmtCeTogJ0AnLFxuXHRcdFx0b3JkZXI6ICdAJ1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6ICcvanMvcmFuay9yYW5rLnRlbXBsYXRlLmh0bWwnXG5cdH1cbn0pOyIsImFwcC5mYWN0b3J5KCdTaWdudXBGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHAsICRzdGF0ZSwgQXV0aFNlcnZpY2UpIHtcblx0Y29uc3QgU2lnbnVwRmFjdG9yeSA9IHt9O1xuXG5cdFNpZ251cEZhY3RvcnkuY3JlYXRlVXNlciA9IGZ1bmN0aW9uKHNpZ251cEluZm8pIHtcblx0XHRjb25zb2xlLmxvZyhzaWdudXBJbmZvKVxuXHRcdHJldHVybiAkaHR0cC5wb3N0KCcvc2lnbnVwJywgc2lnbnVwSW5mbylcblx0XHQudGhlbihyZXMgPT4ge1xuXHRcdFx0aWYgKHJlcy5zdGF0dXMgPT09IDIwMSkge1xuXHRcdFx0XHRBdXRoU2VydmljZS5sb2dpbih7ZW1haWw6IHNpZ251cEluZm8uZW1haWwsIHBhc3N3b3JkOiBzaWdudXBJbmZvLnBhc3N3b3JkfSlcblx0XHRcdFx0LnRoZW4odXNlciA9PiB7XG5cdFx0XHRcdFx0JHN0YXRlLmdvKCdob21lJylcblx0XHRcdFx0fSlcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRocm93IEVycm9yKCdBbiBhY2NvdW50IHdpdGggdGhhdCBlbWFpbCBhbHJlYWR5IGV4aXN0cycpO1xuXHRcdFx0fVxuXHRcdH0pXG5cdH1cblxuXHRyZXR1cm4gU2lnbnVwRmFjdG9yeTtcbn0pIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdzaWdudXAnLCB7XG4gICAgICAgIHVybDogJy9zaWdudXAnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3NpZ251cC9zaWdudXAuaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdTaWdudXBDdHJsJ1xuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ1NpZ251cEN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlLCBTaWdudXBGYWN0b3J5KSB7XG5cbiAgICAkc2NvcGUuc2lnbnVwID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICRzY29wZS5zZW5kU2lnbnVwID0gZnVuY3Rpb24oc2lnbnVwSW5mbyl7XG4gICAgICAgIFNpZ251cEZhY3RvcnkuY3JlYXRlVXNlcihzaWdudXBJbmZvKVxuICAgICAgICAuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9yID0gJ0FuIGFjY291bnQgd2l0aCB0aGF0IGVtYWlsIGFscmVhZHkgZXhpc3RzJztcbiAgICAgICAgfSlcbiAgICB9XG4gICAgXG5cblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uKCRzdGF0ZVByb3ZpZGVyKXtcblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoXCJVc2VyUHJvZmlsZVwiLHtcblx0XHR1cmw6IFwiL3VzZXJzLzp1c2VySWRcIixcblx0XHR0ZW1wbGF0ZVVybDpcImpzL3VzZXJfcHJvZmlsZS9wcm9maWxlLnRlbXBsYXRlLmh0bWxcIixcblx0XHRjb250cm9sbGVyOiBcIlVzZXJDdHJsXCJcblx0fSlcblx0JHN0YXRlUHJvdmlkZXIuc3RhdGUoXCJHYW1lUmVjb3JkXCIsIHtcblx0XHR1cmw6XCIvdXNlcnMvOnVzZXJJZC9nYW1lc1wiLFxuXHRcdHRlbXBsYXRlVXJsOiBcImpzL3VzZXJfcHJvZmlsZS9nYW1lcy5odG1sXCIsXG5cdFx0Y29udHJvbGxlcjogXCJHYW1lUmVjb3JkQ3RybFwiXG5cdH0pXG59KVxuXG5hcHAuY29udHJvbGxlcihcIlVzZXJDdHJsXCIsIGZ1bmN0aW9uKCRzY29wZSwgVXNlckZhY3RvcnksICRzdGF0ZVBhcmFtcyl7XG5cdFVzZXJGYWN0b3J5LmZldGNoSW5mb3JtYXRpb24oJHN0YXRlUGFyYW1zLnVzZXJJZClcblx0LnRoZW4oZnVuY3Rpb24odXNlcil7XG5cdFx0JHNjb3BlLnVzZXI9dXNlcjtcblx0XHRyZXR1cm4gdXNlclxuXHR9KVxuXHQudGhlbihmdW5jdGlvbih1c2VyKXtcblx0XHQkc2NvcGUudXBkYXRlZD0kc2NvcGUudXNlci51cGRhdGVkQXQuZ2V0RGF5KCk7XG5cdH0pXG59KVxuXG5hcHAuY29udHJvbGxlcihcIkdhbWVSZWNvcmRDdHJsXCIsZnVuY3Rpb24oJHNjb3BlLCBVc2VyRmFjdG9yeSwgJHN0YXRlUGFyYW1zKXtcblx0VXNlckZhY3RvcnkuZmV0Y2hJbmZvcm1hdGlvbigkc3RhdGVQYXJhbXMudXNlcklkKVxuXHQudGhlbihmdW5jdGlvbih1c2VyKXtcblx0XHQkc2NvcGUudXNlcj11c2VyO1xuXHR9KVxuXHQudGhlbihmdW5jdGlvbih1c2VyKXtcblx0VXNlckZhY3RvcnkuZmV0Y2hHYW1lcygkc3RhdGVQYXJhbXMudXNlcklkKVxuXHR9KVxuXHQudGhlbihmdW5jdGlvbihnYW1lcyl7XG5cdFx0JHNjb3BlLmdhbWVzPWdhbWVzO1xuXHR9KVxufSkiLCJhcHAuZmFjdG9yeShcIlVzZXJGYWN0b3J5XCIsIGZ1bmN0aW9uKCRodHRwKXtcblx0cmV0dXJuIHtcblx0XHRmZXRjaEluZm9ybWF0aW9uOiBmdW5jdGlvbihpZCl7XG5cdFx0XHRyZXR1cm4gJGh0dHAuZ2V0KFwiL2FwaS91c2Vycy9cIitpZClcblx0XHRcdC50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuXHRcdFx0XHRyZXR1cm4gdXNlci5kYXRhO1xuXHRcdFx0fSlcblx0XHR9LFxuXHRcdGZldGNoR2FtZXM6IGZ1bmN0aW9uKGlkKXtcblx0XHRcdHJldHVybiAkaHR0cC5nZXQoXCIvYXBpL3VzZXJzL1wiK2lkK1wiL2dhbWVzXCIpXG5cdFx0XHQudGhlbihmdW5jdGlvbihnYW1lcyl7XG5cdFx0XHRcdHJldHVybiBnYW1lcy5kYXRhO1xuXHRcdFx0fSlcblx0XHR9XG5cdH1cbn0pIiwiYXBwLmRpcmVjdGl2ZSgnbmF2YmFyJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCBBVVRIX0VWRU5UUywgJHN0YXRlKSB7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICBzY29wZToge30sXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7XG5cbiAgICAgICAgICAgIHNjb3BlLml0ZW1zID0gW1xuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdIb21lJywgc3RhdGU6ICdob21lJyB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdMZWFkZXIgQm9hcmQnLCBzdGF0ZTogJ2xlYWRlckJvYXJkJyB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdZb3VyIFByb2ZpbGUnLCBzdGF0ZTogJ1VzZXJQcm9maWxlJywgYXV0aDogdHJ1ZSB9XG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcblxuICAgICAgICAgICAgc2NvcGUuaXNMb2dnZWRJbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY29wZS5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UubG9nb3V0KCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgc2V0VXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHJlbW92ZVVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IG51bGw7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzZXRVc2VyKCk7XG5cbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcywgc2V0VXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzLCByZW1vdmVVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCByZW1vdmVVc2VyKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG59KTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYXBwLmRpcmVjdGl2ZSgnb2F1dGhCdXR0b24nLCBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7XG4gICAgc2NvcGU6IHtcbiAgICAgIHByb3ZpZGVyTmFtZTogJ0AnXG4gICAgfSxcbiAgICByZXN0cmljdDogJ0UnLFxuICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvb2F1dGgtYnV0dG9uL29hdXRoLWJ1dHRvbi5odG1sJ1xuICB9XG59KTtcbiIsImFwcC5kaXJlY3RpdmUoXCJ0aW1lclwiLCBmdW5jdGlvbigkcSwgJGludGVydmFsLCBTb2NrZXQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICBzY29wZToge1xuICAgICAgICAgICAgdGltZTogJz0nXG4gICAgICAgIH0sXG4gICAgICAgIHRlbXBsYXRlVXJsOiBcImpzL2NvbW1vbi9kaXJlY3RpdmVzL3RpbWVyL3RpbWVyLmh0bWxcIixcbiAgICAgICAgbGluazogZnVuY3Rpb24oc2NvcGUpIHtcbiAgICAgICAgICAgIHZhciB0aW1lID0gc2NvcGUudGltZTtcbiAgICAgICAgICAgIHZhciBzdGFydD1zY29wZS50aW1lO1xuICAgICAgICAgICAgc2NvcGUudGltZV9yZW1haW5pbmcgPSBjb252ZXJ0KHRpbWUpO1xuICAgICAgICAgICAgc2NvcGUuY291bnRkb3duID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRpbWVyID0gJGludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICB0aW1lIC09IDE7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnRpbWVfcmVtYWluaW5nID0gY29udmVydCh0aW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRpbWUgPCAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY29wZS50aW1lX3JlbWFpbmluZyA9IFwiVGltZSB1cCFcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgICRpbnRlcnZhbC5jYW5jZWwodGltZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGltZT1zdGFydDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sIDEwMDApO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gc2NvcGUubWVzc2FnZXMgPSBbXCJHZXQgUmVhZHkhXCIsIFwiR2V0IFNldCFcIiwgXCJHbyFcIiwgJy8nXTtcbiAgICAgICAgICAgIC8vICAgICB2YXIgaW5kZXggPSAwO1xuICAgICAgICAgICAgLy8gICAgIHZhciBwcmVwYXJlID0gJGludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgLy8gICAgICAgICBzY29wZS50aW1lX3JlbWFpbmluZyA9IHNjb3BlLm1lc3NhZ2VzW2luZGV4XTtcbiAgICAgICAgICAgIC8vICAgICAgICAgaW5kZXgrKztcbiAgICAgICAgICAgIC8vICAgICAgICAgY29uc29sZS5sb2coc2NvcGUudGltZV9yZW1haW5pbmcpO1xuICAgICAgICAgICAgLy8gICAgICAgICBpZiAoc2NvcGUudGltZV9yZW1haW5pbmcgPT09IFwiL1wiKSB7XG4gICAgICAgICAgICAvLyAgICAgICAgICAgICBzY29wZS50aW1lX3JlbWFpbmluZyA9IGNvbnZlcnQodGltZSk7XG4gICAgICAgICAgICAvLyAgICAgICAgICAgICAkaW50ZXJ2YWwuY2FuY2VsKHByZXBhcmUpO1xuICAgICAgICAgICAgLy8gICAgICAgICAgICAgdmFyIHRpbWVyID0gJGludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgIHRpbWUgLT0gMTtcbiAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICBzY29wZS50aW1lX3JlbWFpbmluZyA9IGNvbnZlcnQodGltZSk7XG4gICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgaWYgKHRpbWUgPCAxKSB7XG4gICAgICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgIHNjb3BlLnRpbWVfcmVtYWluaW5nID0gXCJUaW1lIHVwIVwiO1xuICAgICAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAkaW50ZXJ2YWwuY2FuY2VsKHRpbWVyKTtcbiAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyAgICAgICAgICAgICB9LCAxMDAwKTtcbiAgICAgICAgICAgIC8vICAgICAgICAgfVxuICAgICAgICAgICAgLy8gICAgIH0sIDEwMDApO1xuICAgICAgICAgICAgLy8gfTtcblxuICAgICAgICAgICAgU29ja2V0Lm9uKCdzdGFydEJvYXJkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUuY291bnRkb3duKHRpbWUpO1xuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgZnVuY3Rpb24gY29udmVydCh0aW1lKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNlY29uZHMgPSAodGltZSAlIDYwKS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgIHZhciBjb252ZXJzaW9uID0gKE1hdGguZmxvb3IodGltZSAvIDYwKSkgKyAnOic7XG4gICAgICAgICAgICAgICAgaWYgKHNlY29uZHMubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgICAgICBjb252ZXJzaW9uICs9ICcwJyArIHNlY29uZHM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29udmVyc2lvbiArPSBzZWNvbmRzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gY29udmVyc2lvbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn0pXG4iLCJhcHAuZGlyZWN0aXZlKCdsb2dvJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvbG9nby9sb2dvLmh0bWwnXG4gICAgfTtcbn0pXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
