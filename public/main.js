const port = 3000 || process.env.PORT;
const socket = io(`https://musical-doodle-r449vq99rqrxf5954-${port}.app.github.dev/`);

socket.on("connect", () => {
    console.log(`Client connecting with socket id:${socket.id}`);
    socket.emit("identify", crypto.randomUUID());
});

let canJoin = true
let disconnectMessage;
socket.on("connectionDenied", (message) => {
    canJoin = false;
    disconnectMessage = message;
});
 
async function getUsers()
{
    const url = `https://musical-doodle-r449vq99rqrxf5954-${port}.app.github.dev/api/users`;

    try
    {
        const response = await fetch(url);

        if (!response.ok)
        {
            throw new Error(`Response status: ${response.status}`);
        }

        const json = await response.json();
        return json.usersOnline;
    }
    catch (error)
    {
        console.error(error.message);
        return [];
    }
}

async function isBtnDisabled()
{
    const url = `https://musical-doodle-r449vq99rqrxf5954-${port}.app.github.dev/api/data?socketId=${socket.id}`;

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

async function switchBtnState()
{
    const url = `https://musical-doodle-r449vq99rqrxf5954-${port}.app.github.dev/api/switchBtnState`;

    try
    {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
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

const divDisconnect = document.createElement("div");
divDisconnect.className = "div-disconnect";
document.body.append(divDisconnect);

const targetFPS = 15;
const msPerFrame = 1000 / targetFPS;
let lastFrameTime = 0;
let btn = document.getElementById("ping-btn");
btn.disabled = true;

async function mainLoop(currentTime)
{
    if (canJoin)
    {
        requestAnimationFrame(mainLoop);

        const elapsed = currentTime - lastFrameTime;

        if (elapsed >= msPerFrame)
        {
            btn.disabled = await isBtnDisabled();
            
            let usersOnline = await getUsers();
            if (usersOnline.length < 2)
            {
                divDisconnect.innerHTML = "There are currently no users online to ping!";
            }
            else
            {
                divDisconnect.innerHTML = "";
            }

            lastFrameTime = currentTime - (elapsed % msPerFrame);
        }
    }
    else
    {
        btn.style.visibility = "hidden";
        divDisconnect.innerHTML = disconnectMessage;
    }
}
requestAnimationFrame(mainLoop);

document.querySelector("#ping-btn").addEventListener("click", () => {
    switchBtnState();
});