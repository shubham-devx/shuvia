const DAY_MS=86_400_000
export function dayDifference(from:Date,to:Date){
 const a=new Date(from.getFullYear(),from.getMonth(),from.getDate()).getTime()
 const b=new Date(to.getFullYear(),to.getMonth(),to.getDate()).getTime()
 return Math.round((b-a)/DAY_MS)
}
export function daysUntil(date:Date,today=new Date()){return dayDifference(today,date)}
export function daysTogether(start:Date,today=new Date()){return Math.max(1,dayDifference(start,today)+1)}
export function annualDateInYear(date:string,year:number){
 const [,month,day]=date.split('-').map(Number),value=new Date(year,month-1,day)
 if(value.getMonth()!==month-1)value.setDate(0)
 return value
}
