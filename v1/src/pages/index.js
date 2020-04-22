import React from "react"
import Layout from "../components/layout"
import Container from "../components/container"
import containerStyles from "../components/link.module.css"
// import Link from "../components/link"
import fetchData from "../components/fetch-data"

const Index = (props) => {

  fetchData();
  
  return (
    <Layout>
      <Container>
        <p>Hello world!</p>
        <button className={containerStyles.link}>Get Strava data</button>
      </Container>
    </Layout>
  );
}

// class Index extends React.Component {
//   // constructor(props) {
//   //   super(props);
//   //   this.state = {isClicked: false};

//   //   this.handleClick = this.handleClick.bind(this);
//   // }

//   handleClick = () => {
//     console.log('clicked');
//   }

//   fetchData = () => {
//     const endpoint = 'https://api.github.com/users/wesbos';

//     const wesPromise = fetch(endpoint);
//     console.log(wesPromise);
//   }

//   fetchData();

//   render() {
//     return (
//       <Layout>
//         <Container>
//           <p>Hello world!</p>
//           <button className={containerStyles.link} onClick={this.handleClick}>Get Strava data</button>
//         </Container>
//       </Layout>
//     );
//   }
// }
export default Index;
