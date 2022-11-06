import { useEffect, useState } from 'react'
import axios from 'axios'
import './App.css';

// interface _interface {
//   id: number,
//   address: string,
//   network: string,
//   actualInterface: string,
//   invalid: boolean,
//   dynamic: boolean,
//   disabled: boolean,
// }

// let arrayInterfaces: _interface[] = []

export default function Home() {

  const [_interfaces, setInterfaces] = useState([])
  const [filteredData, setFilteredData] = useState([])

  const getInterfaces = async () => {
    console.log('getInterfaces')
    const response = await axios.get('http://localhost:3001/interface')
    console.log(response.data)
    setInterfaces(response.data)
    setFilteredData(response.data)
    
  }

  const handleSearch = async (e: any) => {
    console.log('handleSearch', e.target.value)
    // filter data by network
    const filtered = _interfaces.filter((item: any) => {
      return item.network.includes(e.target.value)
    }
    )
    console.log('filtered', filtered)
    setFilteredData(filtered)
  }


  // useEffect async

  useEffect(() => {
    getInterfaces()
  }, [])

  return (
    <div className="container">



      <main className="container">
        <div className="row mt-2" id="search">
          <div className="col-12">
            <div className="input-group mb-3">
              <input type="text" className="form-control" placeholder="Buscar" aria-label="search" aria-describedby="button-addon2" onChange={handleSearch} />
              <button className="btn btn-primary" type="button" id="button-addon2">Buscar</button>
            </div>
          </div>
        </div>



        <table className="table table-striped">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Address</th>
              <th scope="col">Network</th>
              <th scope="col">Actual Interface</th>
              <th scope="col">Invalid</th>
              <th scope="col">Dynamic</th>
              <th scope="col">Disabled</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item: any) => {
              return (
                <tr key={item.id}>
                  <th scope="row">{item.id}</th>
                  <td>{item.address}</td>
                  <td>{item.network}</td>
                  <td>{item.actualInterface}</td>
                  <td>{item.invalid ? 'Yes' : 'No'}</td>
                  <td>{item.dynamic ? 'Yes' : 'No'}</td>
                  <td>{item.disabled ? 'Yes' : 'No'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </main>
    </div>
  )
}
