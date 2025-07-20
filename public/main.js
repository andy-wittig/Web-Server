//----------HTML Elements----------
const gameboardContainer = document.getElementById("gameboard-container");
const gameboardButtons = gameboardContainer.children;
const gameMessage = document.getElementById("game-message");
const playButton = document.getElementById("play-btn");
//----------HTML Elements----------

const socket = io(window.location.origin);

socket.on("connect", () => {
    console.log(`Client connecting with socket id:${socket.id}`);
    socket.emit("identify", crypto.randomUUID());
});

let canUserConnect = true
let disconnectMessage;

socket.on("connectionDenied", (message) => {
    canUserConnect = false;
    disconnectMessage = message;
});

socket.on("boardCleared", () => {
    userHasRolled = false;
    diceRoll = -1;
    console.log("The board was cleared.");
});

let playButtonPressed = false;
playButton.addEventListener("click", function () {
    playButtonPressed = true;
});

let gameboardButtonPressed = false;
let gameboardButtonIndex = 0;
for (let i = 0; i < gameboardButtons.length; i++) 
{
    const button = gameboardButtons[i];
    button.addEventListener("click", () => {
        gameboardButtonIndex = Number(button.dataset.num);
        gameboardButtonPressed = true;
    });
}
 
async function getUsersOnline()
{
    try
    {
        const response = await fetch(`${window.location.origin}/api/users`);

        if (!response.ok) { throw new Error(`Failed to fetch users: ${response.status}`); }

        const data = await response.json();
        return data.usersOnline;
    }
    catch (error)
    {
        console.error("Getting online users failed: ", error.message);
        return [];
    }
}

async function getGameBoard()
{
    try
    {
        const response = await fetch(`${window.location.origin}/api/gameboard`);
        if (!response.ok) { throw new Error(`Failed to fetch gameboard: ${response.status}`); }

        const data = await response.json();
        return data.gameBoard;
    }
    catch(error)
    {
        console.error("Getting the game board failed: ", error);
        return [];
    }
}

async function getWinningPieces()
{
    try
    {
        const response = await fetch(`${window.location.origin}/api/winning-pieces`);
        if (!response.ok) { throw new Error(`Failed to fetch winning pieces: ${response.status}`); }

        const data = await response.json();
        return data.winningPieces;
    }
    catch(error)
    {
        console.error("Getting the winning pieces failed: ", error);
        return [];
    }
}

async function getGameState()
{
    try
    {
        const response = await fetch(`${window.location.origin}/api/gamestate`);
        if (!response.ok) { throw new Error(`Failed to fetch gamestate: ${response.status}`); }

        const data = await response.json();
        return data.currentGameState;
    }
    catch(error)
    {
        console.error("Getting the game state failed: ", error.message);
        return null;
    }
}

async function getUserTurn()
{
    try
    {
        const response = await fetch(`${window.location.origin}/api/user-turn?socketID=${socket.id}`);
        if (!response.ok) { throw new Error(`Failed to fetch if it is users turn: ${response.status}`); }

        const data = await response.json();
        return data.isUserTurn;
    }
    catch(error)
    {
        console.error("Getting if the users turn failed: ", error.message);
        return false;
    }
}

async function getUserPieceType()
{
    try
    {
        const response = await fetch(`${window.location.origin}/api/user-piece-type?socketID=${socket.id}`);
        if (!response.ok) { throw new Error(`Failed to fetch users piece type: ${response.status}`); }

        const data = await response.json();
        return data.pieceType;
    }
    catch(error)
    {
        console.error("Getting users piece type failed: ", error.message);
        return false;
    }
}

const gameState = {
    LOBBY: "lobby",
    PLAYING: "playing",
    GAMEOVER: "gameover",
};

let userHasRolled = false;
let diceRoll = -1;

const targetFPS = 10;
const msPerFrame = 1000 / targetFPS;
let lastFrameTime = 0;

async function mainGameLoop(currentTime)
{
    const elapsed = currentTime - lastFrameTime;

    if (elapsed >= msPerFrame) //limit number of calls to server
    {
        if (canUserConnect)
        {
            let currentGameState = await getGameState();

            await drawGameBoard();

            if (currentGameState == gameState.LOBBY) 
            {
                let usersOnline = await getUsersOnline();
                if (usersOnline.length < 2)
                {
                    gameMessage.innerHTML = "Waiting for enough players to join...";
                    playButton.innerHTML = "o_o";
                    playButton.disabled = true;
                }
                else
                {
                    if (!userHasRolled)
                    {
                        gameMessage.innerHTML = "Roll to see which player goes first!";
                        playButton.innerHTML = "Roll";
                        playButton.disabled = false;
                    }

                    if (playButtonPressed)
                    {
                        await userRollDice();

                        gameMessage.innerHTML = `You rolled a ${diceRoll}.`;
                        playButton.innerHTML = "Roll";
                        playButton.disabled = true;

                        userHasRolled = true;
                    }
                }
            }
            else if (currentGameState == gameState.PLAYING) 
            {
                playButton.innerHTML = "Clear";
                playButton.disabled = false;

                for (let i = 0; i < gameboardButtons.length; i++)
                {
                    gameboardButtons[i].classList.remove("gameboard-btn-win");
                }

                if (playButtonPressed) //Clear the game
                {
                    playButtonPressed = false;
                    try { await fetch(`${window.location.origin}/api/clear-board`, { method: "POST" }); }
                    catch (error) { console.log("Failed to clear board: ", error); }
                }
                else
                {
                    let isMyTurn = await getUserTurn();

                    if (isMyTurn)
                    {
                        gameMessage.innerHTML = "It's your turn, so choose a tile to mark.";

                        if (gameboardButtonPressed)
                        {
                            gameboardButtonPressed = false;
                            if (await userSetGameboard(gameboardButtonIndex))
                            {
                                try { await fetch(`${window.location.origin}/api/switch-turns`, { method: "POST" }); }
                                catch (error) { console.log("Failed to switch turns: ", error); }
                            }
                        }
                    }
                    else { gameMessage.innerHTML = "Please wait while the other player takes their turn."; }
                }
            }
            else if (currentGameState == gameState.GAMEOVER)
            {
                gameMessage.innerHTML = "Game Over!";
                playButton.disabled = true;

                let winningPieces = await getWinningPieces();
                for (let k = 0; k < winningPieces.length; k++)
                {
                    gameboardButtons[winningPieces[k]].classList.add("gameboard-btn-win");
                }
            }
        }
        else
        {
            divDisconnect.innerHTML = disconnectMessage;
        }

        playButtonPressed = false;
        gameboardButtonPressed = false;

        lastFrameTime = currentTime - (elapsed % msPerFrame);
    }
    requestAnimationFrame(mainGameLoop);
}
requestAnimationFrame(mainGameLoop);

function getRandIntFromRange(min, max) //Inclusive
{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function userSetGameboard(index)
{
    const boardPieces = {
        X: "x",
        O: "o",
        CLEAR: "-"
    };

    let gameboard = await getGameBoard();
    let pieceType = await getUserPieceType();

    for (let i = 0; i < gameboard.length; i++)
    {
        for (let j = 0; j < gameboard[i].length; j++)
        {
            let currentIndex = i * (gameboard[i].length) + j;

            if (currentIndex == index)
            {
                if (gameboard[i][j] == boardPieces.X || gameboard[i][j] == boardPieces.O) { return false; }
                else { gameboard[i][j] = pieceType; }
                break;
            }
        }
    }

    try
    {
        const response = await fetch(`${window.location.origin}/api/set-gameboard`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ value: gameboard })
        });

        if (!response.ok)
        {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        console.log(result);
        return true;
    }
    catch (error)
    {
        console.error("The gameboard could not be posted: ", error.message);
        return false;
    }
}

async function userRollDice() //*** ISSUE: Should be a coin toss not dice roll! ***
{
    diceRoll = getRandIntFromRange(1, 6);

    try
    {
        const response = await fetch(`${window.location.origin}/diceroll?socketID=${socket.id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ value: diceRoll })
        });

        if (!response.ok)
        {
            throw new Error(`Response status: ${response.status}`);
        }

        const result = await response.json();
        console.log(result);
    }
    catch (error)
    {
        console.error("The dice roll could not be posted: ", error.message);
    }
}

async function drawGameBoard()
{
    let gameboard = await getGameBoard();

    const boardPieces = {
        X: "x",
        O: "o",
        CLEAR: "-"
    };

    for (let i = 0; i < gameboard.length; i++)
    {
        for (let j = 0; j < gameboard[i].length; j++)
        {
            gameboardButtons[i * (gameboard[i].length) + j].innerHTML = gameboard[i][j];
        }
    }
}