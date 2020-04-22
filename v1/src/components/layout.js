import React from "react"
import Header from "./header"

export default ({ children }) => (
  <div>
    <Header></Header>
    {children}
  </div>
)