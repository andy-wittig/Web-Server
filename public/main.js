const port = 3000;
const socket = io(`http://localhost:${port}`);

socket.on("connect", () => {
    console.log(`Client connecting with socket id:${socket.id}`);
    socket.emit("identify", crypto.randomUUID());
});
 
async function getUsers()
{
    const url = `http://localhost:${port}/api/users`;

    try
    {
        const response = await fetch(url);

        if (!response.ok)
        {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();
        console.log(json);
    }
    catch (error)
    {
        console.error(error.message);
    }
}

async function isBtnDisabled()
{
    const url = `http://localhost:${port}/api/data?socketId=${socket.id}`;

    try
    {
        const response = await fetch(url);

        if (!response.ok)
        {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();
        return json.isDisabled;
    }
    catch (error)
    {
        console.error(error.message);
        return true;
    }
}

async function sendData(clientData)
{
    const url = `http://localhost:${port}/api/submit`;

    try
    {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ data: clientData })
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
        console.error(error.message);
    }
}

const targetFPS = 1;
const msPerFrame = 1000 / targetFPS;
let lastFrameTime = 0;
let btn = document.getElementById("ping-btn");

async function mainLoop(currentTime)
{
    requestAnimationFrame(mainLoop);

    const elapsed = currentTime - lastFrameTime;

    if (elapsed >= msPerFrame)
    {
        btn.disabled = await isBtnDisabled();
        lastFrameTime = currentTime - (elapsed % msPerFrame);
    }
}
requestAnimationFrame(mainLoop);

document.querySelector("#ping-btn").addEventListener("click", () => {
    getUsers();
});