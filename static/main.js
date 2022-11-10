//===================================
//  GLOBALS
//===================================
let device_connected = false;
let history_position = 0;
let command_history = [];
const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder("utf-8");
const flags = new Flags();
const change_event = new Event("change");
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});


// self-defined variables 
let QueryCommandList = [];
var autoSend = { staus: false };

// var autoSend = new Proxy([], {
//   set: function() {
//       console.log('BB02220011DF3000E2806894000040018F22958C7C78A97E');
//   }
// });


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
//===================================
//  Parsers & Generator Functions
function GenerateConnectionId(length) {
  return Math.random()
    .toString(36)
    .slice(2);
}
function generateDropDownList(port_info) {
  if (port_info.length == 0) {
    return '<option value="-1" selected="selected">No Serial Ports</option>';
  }
  // Convert port_info array into an array of serial port paths
  const paths = port_info.map(port => {
    return port.path;
  });
  // Sort using numeric language sensitive string comparison.
  // This will result in a list like so:
  //    ["COM1", "COM2", "COM22", "COM100", "COM120"]
  //
  // vs ES6's default string sort which would result in:
  //
  //    ["COM1", "COM100", "COM120", "COM2", "COM22"]
  //
  paths.sort(collator.compare);
  console.debug(port_info, paths);
  var selected = document.querySelector("#device-select").value;
  let html = "";
  for (let i = 0; i < paths.length; i++) {
    html += `
      <option value="${paths[i]}"
      ${paths[i] === selected ? 'selected="selected"' : ""}>
          ${paths[i]}
      </option>`;
  }
  return html;
}

function generateCommandListHtml(command_list) {
  if (!command_list) {
    return "";
  }

  let html = "";
  for (let command of command_list) {
    html += `<option value="${command}" />`;
  }
  return html;
}

//===================================
//  Web Serial
//===================================
let reader;
let port;

function disconnectFromDevice() {
  device_connected = false;
  if (reader && reader.cancel) {
    reader.cancel();
  }
  $("#connect")
    .addClass("btn-outline-success")
    .removeClass("btn-outline-danger")
    .text("Connect");
  $("#baudrate").prop("disabled", false);
  $("#databits").prop("disabled",false);
  $("#stopbits").prop("disabled", false);
  $("#dtr-control").prop("disabled", true);
  $("#rts-control").prop("disabled", true);
  $("#dtr-control").prop("checked", false);
  $("#rts-control").prop("checked", false);
  term.write("Disconnected\r\n");
}

async function readFromDevice(port) {
  while (port.readable && device_connected) {
    reader = port.readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // reader.cancel() has been called.
          break;
        }
        // value is a Uint8Array.
        let decoded = new TextDecoder().decode(value);
        decoded = decoded.replace(/\n/g, "\r\n");
        term.write(decoded);
      }
    } catch (error) {
      disconnectFromDevice();
      const red = '\x1b[31m';
      const resetColor = '\x1b[0m';
      term.write(red + "Exiting serial monitor due to error: " + error + resetColor);
    } finally {
      // Allow the serial port to be closed later.
      reader.releaseLock();
    }
  }
  await port.close();
}



//===================================
//  Helper function
//===================================
// function intFromBytes( x ){
//     var val = 0;
//     for (var i = 0; i < x.length; ++i) {        
//         val += x[i];        
//         if (i < x.length-1) {
//             val = val << 8;
//         }
//     }
//     return val;
// }

// function getInt64Bytes( x ){
//     var bytes = [];
//     var i = 8;
//     do {
//     bytes[--i] = x & (255);
//     x = x>>8;
//     } while ( i )
//     return bytes;
// }

// function getAscii(x){
//   for (let i = 0; i < x.length; i++)
//   { 
//     var result = "";
//     result += x.charCodeAt(i);
//   }
//   return result;
// }

function hexCharCodeToStr(hexCharCodeStr) {
  var trimedStr = hexCharCodeStr;
  var rawStr = trimedStr.substr(0, 2).toLowerCase() === "0x" ? trimedStr.substr(2) : trimedStr;
  var len = rawStr.length;
  if (len % 2 !== 0) {
      alert("存在非法字符!");
      return "";
  }
  var curCharCode;
  var resultStr = [];
  for (var i = 0; i < len; i = i + 2) {
      curCharCode = parseInt(rawStr.substr(i, 2), 16);
      resultStr.push(String.fromCharCode(curCharCode));
  }
  return resultStr.join("");
}


// Send query command
async function sendQuerycCommand() { 
  // term.write("sendQueryCommand");
  let cr = flags.get("carriage-return-select") ? "\r" : "";
  let nl = flags.get("newline-select") ? "\n" : "";
  let queryCommand =["0xBB", "0x00", "0x22", "0x00", "0x00", "0x22", "0x7E"];
  //let queryCommand = ["FF","2F","31","41","31","30","30", "52","0D"];
  // console.log(`${queryCommand}${cr}${nl}\n\n\n`);

  let result = "";
  for (let i = 0; i < queryCommand.length; i++)
  {
    result += hexCharCodeToStr(queryCommand[i]);
  }
  // console.log(`${result}${cr}${nl}\n\n\n`);
  
  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();
  await writer.write(encoder.encode(`${queryCommand}${cr}${nl}`));
  term.write(encoder);
  writer.releaseLock();
  term.write(encoder.encode(`${queryCommand}${cr}${nl}`));
  // console.log(`${queryCommand}${cr}${nl}\n\n\n`);
  term.write(encoder.encode(`${result}${cr}${nl}`));
  if (device_connected)
  { 
    autoSend.staus = true;
    setTimeout(sendQuerycCommand, 1000);
  }
  else
  {
    return;
  }
  
}


//===================================
//  Button Click Listeners
//===================================
document.querySelector("#connect").addEventListener("click", async () => {
  if (device_connected) {
    disconnectFromDevice();
    return;
  } else {
    try {
      port = await navigator.serial.requestPort();
      const baudRate = Number($("#baudrate").val());
      const dataBits = Number($("#databits").val());
      const stopBits = Number($("#stopbits").val());
      await port.open({ baudRate , dataBits , stopBits});
      await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      device_connected = true;
      $("#connect")
        .removeClass("btn-outline-success")
        .addClass("btn-outline-danger")
        .text("Disconnect");
      $("#baudrate").prop("disabled", true);
      $("#databits").prop("disabled",true);
      $("#stopbits").prop("disabled",true);
      $("#dtr-control").prop("disabled", false);
      $("#rts-control").prop("disabled", false);
      readFromDevice(port);
      // term.write("Connected\r\n");
    } catch (error) {
      const notFoundText = "NotFoundError: No port selected by the user.";
      const userCancelledConnecting = String(error) === notFoundText;
      if (!userCancelledConnecting) {
        alert("Could not connect to serial device.")
      }
    }
  }

  // if (device_connected)
  // {
  //   sendQuerycCommand();
  // }
  // else 
  // { 
  //   return; 
  // }
});





document.querySelector("#dtr-control").addEventListener("click", async () => {
  let dataTerminalReady = !!document.querySelector("#dtr-control").checked;
  await port.setSignals({ dataTerminalReady });
});

document.querySelector("#rts-control").addEventListener("click", async () => {
  let requestToSend = !!document.querySelector("#rts-control").checked;
  await port.setSignals({ requestToSend });
});

document.querySelector("#serial-input").addEventListener("keyup", event => {
  const DOWN_ARROW = 38;
  const UP_ARROW = 40;
  const ENTER_KEY = 13;

  let count_change_flag = true;

  switch (event.which) {
    case UP_ARROW:
      if (history_position > 0) {
        history_position--;
      }
      break;
    case DOWN_ARROW:
      if (history_position < command_history.length) {
        history_position++;
      }
      break;
    case ENTER_KEY:
      $("#serial-send").click();
      break;
    default:
      count_change_flag = false;
      break;
  }
  if (count_change_flag) {
    let command = command_history[command_history.length - history_position];
    if (command) {
      document.querySelector("#serial-input").value = command;
    }
  }
});

document.querySelector("#serial-send").addEventListener("click", async () => {
  let payload = $("#serial-input").val();
  $("#serial-input").val("");

  if (payload !== command_history[command_history.length - 1]) {
    command_history.push(payload);
  }

  history_position = 0;

  let cr = flags.get("carriage-return-select") ? "\r" : "";
  let nl = flags.get("newline-select") ? "\n" : "";

  console.log(`${payload}${cr}${nl}\n\n\n`);

  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();
  await writer.write(encoder.encode(`${payload}${cr}${nl}`));
  term.write(encoder);
  writer.releaseLock();
});

// Common commands default 
document.querySelector("#serial-send-default").addEventListener("click", async () => {
  let payload = $("#serial-input").val();
  $("#serial-input").val("");

  if (payload !== command_history[command_history.length - 1]) {
    command_history.push(payload);
  }

  history_position = 0;

  let cr = flags.get("carriage-return-select") ? "\r" : "";
  let nl = flags.get("newline-select") ? "\n" : "";

  console.log(`${payload}${cr}${nl}\n\n\n`);

  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();
  await writer.write(encoder.encode(`${payload}${cr}${nl}`));
  term.write(encoder);
  writer.releaseLock();
});

// add command button 
// document.querySelector("#add-command").addEventListener("click", async () => {
  
// });








//Clear Button Code
document.querySelector("#clear-button").addEventListener("click", () => {
  // [0m = Reset color codes
  // [3J = Remove terminal buffer
  // [2J = Clear screen
  // [H  = Return to home (0,0)
  term.write("\x1b[0m\x1b[3J\x1b[2J\x1b[H");
});

//Command History Code
document
  .querySelector("#clear-cache-modal-open")
  .addEventListener("click", () => {
    $("#clear-cache-modal").modal("show");
  });

document.querySelector("#clear-command-cache").addEventListener("click", () => {
  flags.set("command-history", [
    /* empty array */
  ]);
});

//Serial File Upload
document.querySelector("#serial-upload").addEventListener("click", () => {
  let serial_file = document.querySelector("#serial-file").files;
  if (!device_connected) {
    alert("Please connect a device before uploading a file.");
    return;
  } else if (serial_file.length === 0) {
    alert("No file selected");
    console.debug("No file");
    return;
  }

  let file = serial_file.item(0);
  let reader = new FileReader();

  // This event listener will be fired once reader.readAsText() finishes
  reader.onload = async () => {
    const writer = port.writable.getWriter();
    await writer.write(reader.result);
    writer.releaseLock();
  };

  // Initiate reading of uploaded file
  reader.readAsArrayBuffer(file);
});

//===================================
//  Initialize everything
//===================================

function ApplyDarkTheme(dark_theme_active) {
  console.debug("Dark theme: ", dark_theme_active);
  let head = document.querySelector("head");
  if (dark_theme_active) {
    head.innerHTML += `<link
      rel="stylesheet"
      type="text/css"
      id="dark-style"
      href="static/lib/themes/dark-theme.css">`;
  } else {
    let dark_style = document.querySelector("#dark-style");
    if (dark_style) {
      head.removeChild(dark_style);
    }
  }
}

function commandHistoryUpdateHandler(command_list) {
  let command_history_element = document.querySelector("#command-history");
  command_history_element.innerHTML = generateCommandListHtml(command_list);
  console.debug("Command history updated");
}

flags.attach("baudrate", "change", "38400");
flags.attach("databits","change","8");
flags.attach("carriage-return-select", "change");
flags.attach("stopbits","change","1");
flags.attach("newline-select", "change", true);
flags.attach("dark-theme", "change", false, ApplyDarkTheme, ApplyDarkTheme);
flags.bind("command-history", commandHistoryUpdateHandler, []);

function main() {
  term.open(document.querySelector("#terminal"));
  fit_addon.fit();
  flags.initialize();
}

$(document).on('click', '.browse', function () {
  var file = $(this).parent().parent().parent().find('.file');
  file.trigger('click');
});
$(document).on('change', '.file', function () {
  $(this).parent().find('.form-control')
    .val($(this).val().replace(/C:\\fakepath\\/i, ''));
});

window.onbeforeunload = () => {
  let command_history = flags.get("command-history");
  if (command_history) {
    flags.set("command-history", command_history.slice(0, 99));
  }
  flags.teardown();
  return null;
};
window.addEventListener("resize", () => {
  fit_addon.fit();
});
// Entry point of software start
window.addEventListener("load", main);

