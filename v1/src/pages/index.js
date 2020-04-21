import React from "react"
import Header from "../components/header"
import Container from "../components/container"
import Link from "../components/link"

class Index extends React.Component {
  render() {
    return (
      <div>
        <Header />
        <Container>
          <p>Hello world!</p>
          <Link>Get Strava data</Link>
        </Container>
      </div>
    );
  }
}
export default Index;
