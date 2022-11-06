import { useEffect, useState } from 'react'
import axios from 'axios'
import './App.css';
import { url } from 'inspector';

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

export default function Queue() {

  const [_interfaces, setInterfaces] = useState([])
  const [filteredData, setFilteredData] = useState([])

  const getInterfaces = async () => {
    console.log('getInterfaces')
    const response = await axios.get('http://localhost:3001/queue')
    console.log(response.data)
    setInterfaces(response.data)
    setFilteredData(response.data)
    
  }

  const handleSearch = async (e: any) => {
    console.log('handleSearch', e.target.value)
    // filter data by network
    const filtered = _interfaces.filter((item: any) => {
      return item.name.toLowerCase().includes(e.target.value.toLowerCase())
    }
    )
    console.log('filtered', filtered)
    setFilteredData(filtered)
  }


  // useEffect async

  useEffect(() => {
    getInterfaces()
  }, [])

  const kbToMb = (kb: number) => {
       const splitkb = kb.toString().split('/')
        const upload = parseInt(splitkb[0])/1000000
        const download = parseInt(splitkb[1])/1000000

        return `${upload.toFixed(0)} M/${download.toFixed(0)}M`

    }

    const formatUrl = (url: string ) =>{
        return url;
    }


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
          <h3>{filteredData.length}</h3>
        </div>



        <table className="table table-striped">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Name</th>
              <th scope="col">target</th>
              <th scope="col">maxLimit</th>
              <th scope="col">Disabled</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item: any) => {
              return (
                <tr key={item.id}>
                  <th scope="row">{item.id}</th>
                    <td>{item.name}</td>
                    <td><a href={formatUrl(item.target)}>{item.target}</a></td>
                    <td>{kbToMb(item.maxLimit)}</td>
                    <td>{
                        item.disabled ?   <span className="badge bg-success">Enabled</span> : <span className="badge bg-danger">Disabled</span>
                        }</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </main>
    </div>
  )
}
