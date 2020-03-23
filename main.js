"use strict";

// data source URL
const dataUrl = "https://raw.githubusercontent.com/pcm-dpc/COVID-19/master/dati-json/dpc-covid19-ita-province.json"

let dataSet
let provinces
let svg
let graphWidth
let graphHeight
let xScale, yScale

let provList
let provById
let provByName
let selectedProvinces = []

let legendSvg

let provGraphs = []
let legendItems = []

let currentDay
let graphLayer
let t0, t1


window.onload = function() {
    readData()
}

function readData() {

    fetch(dataUrl).then(resp=>resp.json()).then(processData).then(createChart)

    /*

    d3.dsv(';','data.csv', d=>{
        d.date = d3.timeParse("%m/%d/%Y")(d.DateRep)
        const countryFld = "Countries and territories"
        d.country = d[countryFld]
        delete d[countryFld]
        return d
    })
    .then(processData)
    */

}

function processData(data) {
    data.forEach(rec=>rec.date = new Date(rec.data))
    dataSet = data = data.sort((a,b) => a.date-b.date)

    t0 = dataSet[0].date
    t1 = dataSet[dataSet.length-1].date

    provinces = data.map(d=>d.denominazione_provincia).sort()
        .filter((item, pos, ary) => { return !pos || item != ary[pos - 1]; })
    provList = []
    provByName = {}
    provById = {}
    provinces.forEach(provName => {
        let cases = getProvData(dataSet, provName, 10)
        if(cases.length > 0) {
            let prov = {
                name: provName,
                id: provList.length,
                cases: cases,
            }
            provList.push(prov)
            provById[prov.id] = prov
            provByName[prov.name] = prov
        }
    })
    updateProvSelector()
}



function getProvData(dataSet, provName, minValue) {
    let data = dataSet
        .filter(d=>d.denominazione_provincia == provName)
        .filter(d=>!isNaN(d.totale_casi))
    const check = d => d.totale_casi >= minValue
    let result = []
    let i = 0
    while(i<data.length) {
        while(i<data.length && !check(data[i])) i++
        if(i>=data.length) break
        let j = i
        let span = []
        for(;j<data.length && check(data[j]);j++) {
            const value = parseFloat(data[j].totale_casi)
            span.push({ date : data[j].date, value : value} )
        }
        result.push(span)
        i = j        
    }
    return result
}


function updateProvSelector() {
    let s = document.getElementById('country-selector')
    let option = document.createElement("option");
    option.value = ""
    option.text = "Select a Province"
    s.appendChild(option)
    provList.forEach(prov => {
        option = document.createElement("option");
        option.value = prov.id
        option.text = prov.name
        s.appendChild(option)
    })
    s.onchange = (e) => {
        let provId = e.target.value
        if(provId != "") {
            addGraph(provById[provId])
            s.value = ""
        }
    }
}

function createChart() {
    let cDiv = d3.select('#c').node()
    graphWidth = cDiv.clientWidth
    graphHeight = cDiv.clientHeight
    const margin = {
        top: 10, 
        right: 60, 
        bottom: 30, 
        left: 60}
    const width = graphWidth - margin.left - margin.right
    const height = graphHeight - margin.top - margin.bottom;

    let mainSvg = d3.select('#c')
        .append("svg")
            .attr('width','100%')
            .attr('height','100%')
    svg = mainSvg.append('g')
            .attr('transform',
                "translate("+margin.left+","+margin.top+")")

    let bg = svg.append('rect')
        .attr('class', 'graph-bg')
        .attr('x',0)
        .attr('y',0)
        .attr('width',width)
        .attr('height',height)
        .attr('fill', '#eee')
        
    let logTicks = [10,20,30,50,100,200,500,1000,2000,5000]   
    xScale = d3.scaleTime()
        .domain([t0,t1])
        .range([0, width])
    svg.append('g')
        .attr('transform', 'translate(0,'+height+')')
        .call(d3.axisBottom(xScale))
    yScale = d3.scaleLog()
        .domain([10,10000])
        .range([height, 0])
    svg.append('g')
        .call(d3.axisLeft(yScale)
            .tickSize(0).tickValues(logTicks)
            .tickFormat(d3.format(".0f")))
    
    legendSvg = mainSvg.append('g').attr('transform',"translate(100,30)")

    graphLayer = svg.append('g')
    currentDay = svg.append('g')
    currentDay.append('line')
        .attr('x0',0).attr('x1',0)
        .attr('y0',0).attr('y1',height)
        .attr('stroke', 'gray')
    currentDay.attr('visibility', 'hidden')        
    bg.on('mousemove', () => {
        let coords = d3.mouse(bg.node())
        let x = Math.round( xScale.invert(coords[0]))
        // console.log(x, new Date(x))
        visualizeDayData(new Date(x))
    } )
    bg.on('mouseout', () => currentDay.attr('visibility', 'hidden')  )
}

function visualizeDayData(d) {

    d = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    let x = xScale(d)
    currentDay
        .attr('transform','translate('+x+',0)')
        .attr('visibility', 'visible')

    currentDay.selectAll('.currentDay').remove()
    selectedProvinces.forEach(prov => {
        let point = getClosestPoint(prov.cases.flat(), d)
        if(point != null && Math.abs(d - point.date) < 43200000) {
            let y = yScale(point.value)
            currentDay.append('circle')
                .attr('cx', 0).attr('cy',y).attr('r', 5)
                .attr('class', 'currentDay')
                .style('stroke', 'black')
                .style('fill', '#888')
                .style('opacity', 0.5)

            currentDay.append('rect')
                .attr('x', 10)
                .attr('y', y-15)
                .attr('width', 50)
                .attr('height', 20)
                .attr('rx', 5)
                .attr('class', 'currentDay')
                .attr('fill', 'white')
                .attr('stroke', 'gray')
            currentDay.append('text')
                .text(point.value)
                .attr('class', 'currentDay')
                .attr('fill', prov.color)
                .attr('transform', 'translate(20,'+y+')')


        }

    })

}

function getClosestPoint(points, date) {
    if(!points || points.length == 0) return null
    let n = points.length
    if(date<=points[0].date) return points[0]
    else if(date>=points[n-1].date) return points[n-1]
    let a = 0, b = n-1
    if(date<=points[a].date || date>=points[b].date) throw "uffa"
    while(b-a>1) {
        let c = Math.floor((a+b)/2)
        if(points[c].date <= date) a=c
        else b=c
    }
    if(date<points[a].date || date>=points[b].date) throw "uffa2"
    if(date - points[a].date < points[b].date - date) 
        return points[a]
    else 
        return points[b]
}


function selectColorIndex() {
    let touched = {}
    selectedProvinces.forEach(prov => touched[prov.colorIndex] = true)
    let n = d3.schemeCategory10.length
    for(let i=0; i+1<n; i++) {
        if(!touched[i]) return i
    }
    return n-1
}


function addGraph(prov) {
    let data = prov.cases
    if(!data) return null;

    let g = graphLayer.append('g').attr('class','graph-'+prov.id)

    // select color
    let colorIndex = selectColorIndex()
    prov.colorIndex = colorIndex
    let color = prov.color = d3.schemeCategory10[colorIndex]

    // add new graph
    provGraphs.push(g)

    data.forEach(span => {
        if(span.length>=2) {
            g.append('path')
                .datum(span)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', 1.5)
                .attr('d', d3.line()
                    .x(d => xScale(d.date))
                    .y(d => yScale(d.value))
                )
        }
        g.append('g')
            .selectAll('dot')
            .data(span)
            .enter()
            .append('circle')
                .attr('cx', d=>xScale(d.date))
                .attr('cy', d=>yScale(d.value))
                .attr('r', 2)
                .attr('fill', color)        
    })
    selectedProvinces.push(prov)
    updateLegend()
    return g

}

function addLegend(prov) {
    let color = prov.color
    let index = legendItems.length
    let g = legendSvg.append('g')
        .attr('transform', "translate(0,"+ index*20 +")")
        .attr('class','legend-'+prov.id)

    legendItems.push(g)

    g.append('circle')
        .attr('cx',0)
        .attr('cy',-2)
        .attr('r',6)
        .style("fill", color)
    
    g.append("text")
        .attr("x", 10).attr("y", 0)
        .text(prov.name)
        .style("font-size", "15px")
        .attr("alignment-baseline","middle")
    
    g.append('text').text('(x)').attr('x',50).style('cursor','pointer').on('click', ()=>removeProv(prov))

    return 10

}

function updateLegend() {
    let g = legendSvg.selectAll('g').data(selectedProvinces)
    let newg = g.enter().append('g').attr('class', d=>'legend legend-'+d.id)
    
    newg.append('text')
        .attr("x", 10)
        .attr("y", 0)
        .attr('class', 'name')

    newg.append('circle')
        .attr('cx',0)
        .attr('cy',-5)
        .attr('r',6)

    newg.append('text')
        .text('(x)')
        .attr('class', 'del-btn')
        .attr('x',-30)
        .style('cursor','pointer')
        .on('click', (d,i) => removeProv(selectedProvinces[i]))
    g.exit().remove()


    g.merge(newg)
        .attr('transform', (d,i)=>"translate(0,"+ i*20 +")")
        .attr('class', d=>'legend legend-'+d.id)

    // appearently there is a problem with d3 data binding and child element
    // there should be a better way to do this! :(
    legendSvg.selectAll('text.name').data(selectedProvinces).text(d=>d.name)
    legendSvg.selectAll('circle').data(selectedProvinces).attr('fill', d=>d.color)
}

function removeProv(prov) {
    console.log("remove", prov)
    d3.select('.graph-'+prov.id).remove()
    let i = selectedProvinces.map(d=>d.id).indexOf(prov.id)
    if(i>=0) selectedProvinces.splice(i,1)
    updateLegend() 
}
