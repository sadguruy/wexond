import "../history.scss";

import react from "react";
import reactDom from "react-dom";

import History from "../components/History";

// Wait for sass load.
setTimeout(function() {
  ReactDOM.render(<History />, document.getElementById("app"));
}, 1);
