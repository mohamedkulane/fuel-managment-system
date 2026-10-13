"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, apiBase } from "../../lib/api";
import { businessDate, decimal, formatFuel } from "../../lib/format";
import { ActionButton, ActionLink, ActionAnchor, FormLabel } from "../../components/controls";
import { Card, Empty, ErrorState, LoadingState } from "../../components/ui";
type ManifestLine={customer:string;phone:string;address:string;fuel:string;fuusto:string;notes:string};
export default function DeliveriesPage(){
 const [date,setDate]=useState(businessDate);
 const list=useQuery({queryKey:["daily-manifest",date],queryFn:()=>api<ManifestLine[]>("/simple/delivery-list?date="+date)});
 return <main className="page manifest-page"><div className="page-actions no-print"><ActionLink className="btn" href="/orders">Back to Orders</ActionLink><div className="field"><FormLabel htmlFor="manifest-date">Taariikhda (Date)</FormLabel><input type="date" id="manifest-date" className="input" value={date} onChange={e=>setDate(e.target.value)}/></div><ActionButton className="btn" disabled={!list.data} onClick={()=>window.print()}>Print List</ActionButton><ActionAnchor className="btn primary" href={apiBase+"/simple/delivery-list/pdf?date="+date} target="_blank" rel="noreferrer">Download PDF</ActionAnchor></div><Card className="document-card"><div className="document-heading"><strong>fueldesk.</strong><div><h1>Liiska Gaarsiinta</h1><p>{date}</p></div></div>{list.isPending?<LoadingState/>:list.isError?<ErrorState message={list.error.message} retry={()=>void list.refetch()}/>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Macmiil</th><th>Telefoon</th><th>Goobta</th><th>Shidaalka</th><th>Fuusto</th><th>Faahfaahin</th></tr></thead><tbody>{list.data?.map((line,index)=><tr key={index}><td>{line.customer}</td><td>{line.phone}</td><td>{line.address}</td><td>{formatFuel(line.fuel)}</td><td>{decimal(line.fuusto)}</td><td>{line.notes}</td></tr>)}</tbody></table>{!list.data?.length&&<Empty>Ma jiraan dalabyo la gaarsiinayo taariikhdan.</Empty>}</div>}</Card></main>;
}


