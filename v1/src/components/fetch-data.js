
const fetchData = () => {
  
  function handleError(err) {
    console.log(err);
  }
  
  const baseEndpoint = 'https://api.github.com';
  const userEndpoint = `users/david-matthew`

  async function getUser() {
    const response = await fetch(`${baseEndpoint}/${userEndpoint}`);
    const data = await response.json();

    console.log(data)
  }

  getUser().catch(handleError);

}

export default fetchData;
