

Shahmir Khan July 19th, 2025

Had quite a fever today and spent most of the day in bed... big sad
But oh well I'm feeling much better now so let's crank out the finishing touches on this program
I might stay up overnight and mess up my sleep schedule again... but thats a sacrifice im willing to make


 # Package version issues  
After running the July9rebuild branch from robert I get a white screen when I try to run the web app as well as wrong version errors for some of the packages

```
The following packages should be updated for best compatibility with the installed expo version:
  expo@53.0.13 - expected version: 53.0.20
  react-native@0.79.4 - expected version: 0.79.5
Your project may not work correctly until you install the expected versions of the packages.
```


So I changed package.json to use expo 53.0.20 and react native 0.79.5, deleted package-lock.json and node_modules folder and did npm install to repull the packages


 # Blank web page

When running the web app it is still blank, opening inspect element and checking console shows the error:
```
Uncaught SyntaxError: Failed to construct 'RTCPeerConnection': '' is not a valid URL.
    at CallProvider (CallContext.js:89:9)
```

This means that our .env isn't setup properly (which I know) but also that callcontext.js will die if the .env variables aren't setup properly which is not intended behaviour.


To fix this issue I had to edit the app.config.js file to have proper fallback values for all the variables
```
extra: {
      SECRET1: process.env.SECRET1 || "Fallback secret",
      SIGNALING_SERVER_URL: process.env.SIGNALING_SERVER_URL || "ws://localhost:8080/signal",
      STUN_SERVER_URL: process.env.STUN_SERVER_URL || "stun:stun.l.google.com:19302",
      TURN_SERVER_URL: process.env.TURN_SERVER_URL || "turn:localhost:3478",
      TURN_SERVER_TCP_URL: process.env.TURN_SERVER_TCP_URL || "turn:localhost:3478?transport=tcp",
      TURN_SERVER_TLS_URL: process.env.TURN_SERVER_TLS_URL || "turn:localhost:443?transport=tcp",
      TURN_USERNAME: process.env.TURN_USERNAME || "username",
      TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || "password",
      ICE_CANDIDATE_POOL_SIZE: process.env.ICE_CANDIDATE_POOL_SIZE || "10",
      BUNDLE_POLICY: process.env.BUNDLE_POLICY || "balanced",
      RTCP_MUX_POLICY: process.env.RTCP_MUX_POLICY || "require",
      ICE_TRANSPORT_POLICY: process.env.ICE_TRANSPORT_POLICY || "all",
    },
```

Now that the fallback variables were no longer blank, this should work. However I was still getting the same issue.
The reason for this was that the previous values were saved in the project cache
To clear project cache I had to run:
```
npx expo start -c
```


Now all the env variables use the correct fallback values when there is no .env file present


 # .env.example has wrong encoding

The .env.example file that is in our repo is not using UTF-8 no BOM encoding

I have replaced the file with one using the correct encoding

Now when you change the values and remove the .example from the name it should correctly work


You can know if its working if you see 
```
shahmir@BSMT-MainMint:~/Documents/GitHub/ReactNative-WebRTCApp-July9rebuild/ReactNative-WebRTCApp$ npx expo start -c
env: load .env
env: export SIGNALING_SERVER_URL STUN_SERVER_URL TURN_SERVER_URL TURN_SERVER_TCP_URL TURN_SERVER_TLS_URL TURN_USERNAME TURN_CREDENTIAL ICE_CANDIDATE_POOL_SIZE BUNDLE_POLICY RTCP_MUX_POLICY ICE_TRANSPORT_POLICY
Starting project at /home/shahmir/Documents/GitHub/ReactNative-WebRTCApp-July9rebuild/ReactNative-WebRTCApp
[dotenv@17.2.0] injecting env (0) from .env (tip: ⚙️  load multiple .env files with { path: ['.env.local', '.env'] })
[dotenv@17.2.0] injecting env (0) from .env (tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild)
[dotenv@17.2.0] injecting env (0) from .env (tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild)
```

Even though dotenv is saying that it injected 0 variables, the part where it says:
```
env: load .env
env: export SIGNALING_SERVER_URL STUN_SERVER_URL TURN_SERVER_URL TURN_SERVER_TCP_URL TURN_SERVER_TLS_URL TURN_USERNAME TURN_CREDENTIAL ICE_CANDIDATE_POOL_SIZE BUNDLE_POLICY RTCP_MUX_POLICY 
```
Shows that the shell environment is already loading these variables for us, thus dotenv doesn't try to overwrite them.


IMPORTANT NOTE!

Always clear expo project cache after changing the .env file! 
```
npx expo start -c

or 

npx expo start --clear
```

You know what, I'm just gonna change the start script in package.json to include this in the first place

Changed:
```
"scripts": {
    "start": "expo start",
```

To

```
"scripts": {
    "start": "expo start -c",
```


Also we should probably use dotenvx instead of dotenv
Its made by the same author and is an improved version with encryption



 # Testing backend

Okay now that the project is up and running without errors and the .env file works, we can now start up our backend

We can use my unified Signalling/TURN server from 
https://github.com/shahmir-k/pionly-stunturn-server-seperate-logging


Welp this didn't work at all, my unified backend server was only tested on windows and doesn't actually work on linux. Time to work on the backend


Okay so I have spent the last 2-3 hours fixing up the backend with a lot of new changes

Here are some of the commits made:

```
Update start-server.sh for linux
Fixed the autodetect IP issue in the start script for linux. As well as adding detailed instructions for installing Go if not already present


Update .gitignore
Added exclusions for go-server build artifact when using start script for linux


Update Readme instructions
Updated launch instructions in the readme to be up to date


Updated main.go
- Made HTTP/HTTPS port variable
- Made Stun/Turn ports variable
- Added global variable for public IP
- Added bool to represent if certs were detected
- changed default user:pass combination
- Fixed linux seperate log window launch
- Fixed Linux seperate log window shutdown
- Removed syscall.Handle as it is windows only
```


So now finally the unified backend works on linux and I am able to connect to it when doing local development

The default fallback values in app.config.js will work with the default values of the unified backend

No need to have a .env file when doing local testing


Unfortunately I only have 1 camera, so I can't test video stream switching until I plug another one in.


For now lets work on the WebRTC functions file.


 # WebRTC Functions File

After doing a bunch of research on how hooks work in react/reactnative
I have come to understand somewhat how the useWebRTC file works in the BenchPress2000 repo

I have now converted that file into a .js file and removed all the typescript nonsense

As well as importing the objects from react-native-webrtc-web-shim package

Trying to implement the useWebRTC.js hook file is blowing up the entire code base 😞

I kinda understand how it would work with the original codebase, but not with the changes robert made through adding CallStart and useCall. 

I might try to revert back to the original code and implement useWebRTC.js, that might be a better way.



