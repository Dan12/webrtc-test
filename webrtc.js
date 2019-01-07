let uuidsElt;
let pingsElt;

function errorHandler(error) {
  console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

class WebsocketConnection {
  
  constructor() {
    this.uuid = createUUID();
    console.log(this.uuid)
    this.serverConnection = new WebSocket('wss://' + window.location.hostname + ':8443');
    this.serverConnection.onmessage = (msg) => {
      this.handleWSMessage(msg);
    };
    this.serverConnection.onopen = (event) => {
      // send an init uuid broadcast
      this.send({new_uuid: this.uuid});
    }

    this.connections = {};
  }

  send(data) {
    data.uuid = this.uuid;
    this.serverConnection.send(JSON.stringify(data));
  }

  handleWSMessage(msg) {
    console.log("server message");
    console.log(msg);
    let data = JSON.parse(msg.data);

    // Ignore broadcast messages from ourself
    if(data.uuid == this.uuid) return;

    if (data.new_uuid) {
      // show all new uuids that are broadcasted
      const uuid = data.new_uuid;
      const uuidElt = document.createElement("div");
      uuidElt.innerHTML = uuid;
      uuidElt.addEventListener("click", () => {
        const pc = new PeerConnection(this, uuid, true);
        console.log(pc);
        this.connections[uuid] = pc;
        uuidsElt.removeChild(uuidElt);
      })
      uuidsElt.appendChild(uuidElt);
    } else if (data.to_uuid == this.uuid) {
      if (!this.connections[data.uuid]) {
        this.connections[data.uuid] = new PeerConnection(this, data.uuid, false);
      }
      const pc = this.connections[data.uuid]; 
      if(data.sdp) {
        pc.onsdp(data.sdp);
      } else if(data.ice) {
        pc.onice(data.ice);
      }
    }
  }
}

class PeerConnection {

  constructor(wss, to_uuid, initiate) {
    this.wss = wss;
    this.to_uuid = to_uuid;

    let peerConnectionConfig = {
      'iceServers': [
        {'url': 'stun:stun.services.mozilla.com'},
        {'url': 'stun:stun.l.google.com:19302'},
      ]
    };
    this.peerConnection = new RTCPeerConnection(peerConnectionConfig);
    this.peerConnection.onicecandidate = (event) => { this.gotIceCandidate(event); };

    this.peerConnection.ondatachannel = (event) => {
      console.log("connection channel");
      console.log(event);
      event.channel.onmessage = (e) => {
        console.log("message");
        console.log(e);
        const data = JSON.parse(e.data);
        if (data.ping) {
          dc.send(JSON.stringify({pong: (new Date().getTime())}));
        }
      }
      event.channel.onopen = (e) => {
        console.log("opened channel");
        console.log(e);
        const pingElt = document.createElement("button");
        pingElt.innerHTML = `ping ${this.to_uuid}`;
        pingElt.addEventListener("click", () => {
          dc.send(JSON.stringify({ping: (new Date().getTime())}));
        })
        pingsElt.appendChild(pingElt);
      }
      event.channel.onclose = (e) => {
        console.log("closed channel");
        console.log(e);
      }
    }
    var dc = this.peerConnection.createDataChannel("my channel");

    if (initiate) {
      this.peerConnection.createOffer().then((desc) => {this.createdDescription(desc); }).catch(errorHandler);
    }
  }

  onsdp (sdp) {
    this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp)).then(() => {
      // Only create answers in response to offers
      if(sdp.type == 'offer') {
        this.peerConnection.createAnswer().then((desc) => {this.createdDescription(desc); }).catch(errorHandler);
      }
    }).catch(errorHandler);
  }

  onice(ice) {
    this.peerConnection.addIceCandidate(new RTCIceCandidate(ice)).catch(errorHandler);
  }

  gotIceCandidate(event) {
    console.log("ice candidate");
    console.log(event);
    if(event.candidate != null) {
      this.wss.send({'ice': event.candidate, 'to_uuid': this.to_uuid});
    }
  }

  createdDescription(description) {
    console.log('got description');

    this.peerConnection.setLocalDescription(description).then(() => {
      this.wss.send({'sdp': this.peerConnection.localDescription, 'to_uuid': this.to_uuid});
    }).catch(errorHandler);
  }
}

function pageReady() {
  console.log("ready");

  uuidsElt = document.getElementById('uuids');
  pingsElt = document.getElementById('pings');
  new WebsocketConnection();
}