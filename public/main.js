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

let playButtonPressed = false;
playButton.addEventListener("click", function () {
    playButtonPressed = true;
});
 
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
        const response = await fetch(`${window.location.origin}/api/gameboard`)
        if (!response.ok) { throw new Error(`Failed to fetch gameboard: ${response.status}`); }

        const data = await response.json();
        return data.gameBoard
    }
    catch(error)
    {
        console.error("Getting the game board failed: ", error)
        return null;
    }
}

async function getGameState()
{
    try
    {
        const response = await fetch(`${window.location.origin}/api/gamestate`)
        if (!response.ok) { throw new Error(`Failed to fetch gamestate: ${response.status}`); }

        const data = await response.json();
        return data.currentGameState
    }
    catch(error)
    {
        console.error("Getting the game state failed: ", error.message)
        return null;
    }
}

const gameState = {
    LOBBY: "lobby",
    PLAYING: "playing",
    GAMEOVER: "gameover",
}

const targetFPS = 1;
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
                    gameMessage.innerHTML = "Roll too see which player goes first!";
                    playButton.innerHTML = "Roll";
                    playButton.disabled = false;

                    if (playButtonPressed)
                    {
                        await userRollDice();
                        playButtonPressed = false;
                    }
                }
            }
            else if (currentGameState == gameState.PLAYING) 
            {
                drawGameBoard()
            }
            else if (currentGameState == gameState.GAMEOVER) {}
        }
        else
        {
            divDisconnect.innerHTML = disconnectMessage;
        }

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

async function userRollDice()
{
    let diceRoll = getRandIntFromRange(1, 6);

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
    let gameboard = await getGameBoard()
    if (gameboard === null) 
    { 
        console.log("Game board could not be drawn!");
        return; 
    }

    const boardPieces = {
        X: "x",
        O: "o",
        CLEAR: ""
    }

    for (let i = 0; i < gameboard.length; i++)
    {
        for (let j = 0; j < gameboard[i].length; j++)
        {
            gameboardButtons[i][j].innerHTML = gameboard[i][j];
        }
    }
}