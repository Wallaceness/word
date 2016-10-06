var User = require('../db/models/user');
var Game = require('../db/models/game');
var UserGame = require('../db/models/userGame');

module.exports = {
    startGame: function(gameId){
        Game.findById(gameId)
            .then(game => game.update({
                isWaiting: false
            }))
            .catch(function(e) {
                console.error('the game did not start correctly!', e);
            });
    },

    saveGame: function(gameObj) {
        console.log('save game go.id: ', gameObj.id);
        Game.findById(gameObj.id, {
                include: [{
                    model: User,
                    attributes: ['id']
                }]
            })
            .then(game => {
                let updatePromises = [];
                game.users.forEach(user => {
                    updatePromises.push(user.userGame.update({
                        score: gameObj.playerScores[user.id]
                    }));
                });
                updatePromises.push(game.update({ inProgress: false }));
                console.log('about to run updated scores: ', updatePromises);
                return Promise.all(updatePromises);
            })
            .catch(function(e) {
                console.error('the game did not save correctly!', e);
            });
    }
};