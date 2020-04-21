import React from "react"
import containerStyles from "./header.module.css"

class Header extends React.Component {
  render() {
    return (
    <header className={containerStyles.header}>
      <h2>台灣鄉鎮挑戰</h2>
      <nav className={containerStyles.navigation}>
        <h4>Join</h4>
        <h4>About</h4>
      </nav>
    </header>
    );
  }
}
export default Header;
