import React from "react"
import containerStyles from "./link.module.css"

export default ({ children }) => (
  <a href="#" className={containerStyles.link}>{children}</a>
)