import React from "react"
import { Link } from "gatsby"
import containerStyles from "./header.module.css"

class Header extends React.Component {
  render() {
    return (
    <header className={containerStyles.header}>
      <h2>台灣鄉鎮挑戰</h2>
      <nav className={containerStyles.navigation}>
        <h4>Join</h4>
        <Link to="/about/">About</Link>
      </nav>
    </header>
    );
  }
}
export default Header;
