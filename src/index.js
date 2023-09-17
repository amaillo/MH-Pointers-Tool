const {
  QMainWindow,
  QWidget,
  QLabel,
  FlexLayout,
  QPushButton,
  QMenuBar,
  QMenu,
  QAction,
  QListWidget,
  QListWidgetItem,
  QLineEdit,
  QBoxLayout,
  QPlainTextEdit,
  QFileDialog,
  QCheckBox,
  QMessageBox,
  QDragMoveEvent,
  WidgetEventTypes,
  QDropEvent,
  QApplication,
  QClipboardMode,
  QDialog,
  QIcon,
  QButtonGroup,
  QRadioButton

} = require("@nodegui/nodegui");

const fs = require('fs')
const path = require('path')
const EncodingModule = require('encoding-japanese');

let stringsArr = []
let textToSearchOld = ""
let searchSet = 0
let textToSearch = ""
let matchSearch = []
let match = false
let currentContent = ""
let rawStrings = [] //in hex, contains all 00
let extractedStrings = []
let selectedFile = ""
let string1AddressDecimal= ""
let string2AddressDecimal = ""
let pointer1AddressDecimal= ""
let pointer2AddressDecimal = ""
let extractedStringsOLD = ""
let numSpaceLeft = 0
let addressOfEachString = []
let addressOfEachPointer = []
let pointersHexValues = []
let addressOfEachStringInMemory= []
let extractedPointersIn4= []
let extractedPointersIn4Non0= []
let extractedPointers = ""
let oldPointersHexValues = []
let savedString = ""
let projectsConfHexArr = []
let oldRawString = ""
let oldSelectedString = -1
let sharedPointers = 0
let oldMatchedSharedPointers = []
let sectionNameHeader= "Section name"
let hiddenPointers = 0
let selectedTablePointers = []
let extractedTablePointersRaw = []
let extractedTablePointers = ""
let extractedTablePointersIn4 = []
let extractedTablePointersIn4Non0 = []
let tableStartPointerFileAddresses = []
let tableEndPointerStartStringFileAddresses = []
let tableEndStringFileAddresses = []
let sectionedCurrentContent = []
let selectedPTFile = ""
let pointersTableMode = false
let csvTranslationMode = false
let exportAllMode = false
let exportAllModeVariable = 0
let pointersTableModeSettingsArr = []
let currentTableContent = []
let organizedSections = []
let oldSelectedTablePointers = []
let stringsOffset = 0
let stringsOldOffset = 0
let shiftJISEncoding = false
let UTF8Encoding = true
let originalExtractedStringsLength = 0
let globalOffset = 0
let stopExport = false
let skipExport = false
let postLastStringAddress
let globalExtractedStrings = []
let globalAddressOfEachString = []
let oldcurrentContentLength
let timer

//Take the text on the "Search..." square and use it to find matches, then saves the position of matched strings in matchSearch.
function saveItemsInArr(textToSearch){
  matchSearch = []
  if (textToSearch != ""){
    for(i=0;i<listWidget.count();++i){
      stringsArr[i] = listWidget.item(i).text()
    }
  }
  i = 0

  while(i < listWidget.count()){

    if(stringsArr[i].toLowerCase().includes(textToSearch.toLowerCase()) ===true){

      matchSearch[i] = i
    }

    i=i+1;
  }
}

//Uses the position of the saved strings in matchSearch to move to the right item position in the listWidget
//that match with the search.
function setNextItem(){

  while(searchSet < matchSearch.length){

    match = false;
 
    if(matchSearch[searchSet] != undefined){
      listWidget.setCurrentRow(searchSet)
      
      listWidget.scrollToItem(listWidget.item(searchSet))
      listWidget.item(searchSet).setSelected(true)
      stringEditorTextEdit.setPlainText(listWidget.item(searchSet).text())

      sectionDetailsLabel.setText(`${sectionNameHeader}: String#${listWidget.currentRow()+1}`)

      if(pointer1AddressDecimal!= ""){
        stringAdressLabel.setText(`String Address: ${addressOfEachString[listWidget.currentRow()]}`+"/"+ "0x" + `${addressOfEachStringInMemory[listWidget.currentRow()].toString(16).toUpperCase().replaceAll("00","")}`)

      }else{
        stringAdressLabel.setText(`String Address: ${addressOfEachString[listWidget.currentRow()]}`)
      }

      if(pointer1AddressDecimal!= ""){
        pointerValuesLabel.setText(`Pointer HexValues: ${pointersHexValues[listWidget.currentRow()].toString(16).toUpperCase()}`)

      }

      match = true
    }
      searchSet = searchSet+1

    if (match===true){

      break
    }
  }

  if(searchSet===matchSearch.length){
    searchSet = 0
  }
}

//Open a file dialog to choose a file and save it path in selectedFile.
function loadFile() {

  let goBack = true
    
  fileDialog.addEventListener("fileSelected",function(){

      if(fileDialog.selectedFiles().length!=0&&
        fs.lstatSync(fileDialog.selectedFiles()[0]).isDirectory()===false){

          selectedFile = fileDialog.selectedFiles();
          start()
        goBack = false
      }else{
        selectedFile = filePathQLineEditRead.text()
        start()
        return
      }
    })

  fileDialog.exec();

  if(goBack===true){
    return 1
  }
};

//Put selectedFile data in a filePathQLineEditRead to be used later.
function start(){

  if(selectedFile ===""||fs.existsSync(`${selectedFile}`) ===false){

    filePathQLineEditRead.setText(`${selectedFile}`)
  }else if((fs.readFileSync(`${selectedFile}`)).length>0){

    currentContent = fs.readFileSync(`${selectedFile}`);
    filePathQLineEditRead.setText(`${selectedFile}`)
    mainMenuAction3.setEnabled(true)
  }

  if(pointersTableMode===true){
    mainMenuAction3.setEnabled(false)
  }
}

//Uses only 1-6 Hex characters with a usable offset.
//Makes visible all the hidden options and then uses the given addresses by the user to
//get the pointers (extractedPointers), add them as items in the pointers viewer and save them for later, 
//then does the same for the text in the file (extractedStrings), add those to the listWidget and also
//transform the Shift-Jis text to UTF8. Additionally saves a copy of extractedStrings to use it as reference to know
//the amount of space that never must be surpassed.
function saveAndPrepare(tableMode){

  if(  firstStringAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && lastStringAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && firstPointerAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && lastPointerAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && fs.existsSync(`${selectedFile}`) === true){

    console.log("Both strings and pointers address are in a correct hex format!")

  }else{
    if(exportAllMode===false){
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText("Not correct hex format or invalid file path, aborting...")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
    }else{
      skipExport=true
    }
    return
  }

  let pointer1Address = firstPointerAddressLineEdit.text()
  let pointer2Address = lastPointerAddressLineEdit.text()

  pointer1AddressDecimal= parseInt(pointer1Address,16)
  pointer2AddressDecimal = parseInt(pointer2Address,16)

  if(pointer1AddressDecimal>currentContent.length ||
    pointer2AddressDecimal>currentContent.length){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("At least one pointer address is too big for this file x_x")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return

  }else if(pointer2AddressDecimal<pointer1AddressDecimal){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Invalid pointers scheme, the first pointer address\nis greater than the first one")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return

  }else if(pointer2AddressDecimal===pointer1AddressDecimal){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Invalid pointer addresses, same addresses")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return

  }

  let string1Address = firstStringAddressLineEdit.text()
  let string2Address = lastStringAddressLineEdit.text()

  string1AddressDecimal= parseInt(string1Address,16)
  string2AddressDecimal = parseInt(string2Address,16)

  if(string1AddressDecimal>currentContent.length ||
    string2AddressDecimal>currentContent.length){

      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText("At least one string address is too big for this file x_x")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
      return

  }else if(string2AddressDecimal<string1AddressDecimal){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Invalid string scheme, the first string address\nis greater than the first one")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()

    return
  }else if(string2AddressDecimal===string1AddressDecimal){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Invalid string addresses, same addresses")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()

    return
  }

  setDefaultValues(1)

  pointersViewerButtonToHide00.setEnabled(true)
  csvButton.setEnabled(true)
  csvButton2.setEnabled(true)
  exportAllButton.setEnabled(true)
  pointersEditorRealocateButton.setEnabled(true)
  pointersEditorSaveButton.setEnabled(true)
  pointersEditorLabel.setEnabled(true)
  pointersEditor.setEnabled(true)
  pointersViewerForSharedPointersListWidget.setEnabled(true)
  bigEndian.setEnabled(false)
  fastButton.setEnabled(false)

  extractedPointers = currentContent.slice(pointer1AddressDecimal,pointer2AddressDecimal)

  let i = 0

  start()

  if(listWidget.item(i) != undefined) {
    listWidget.clear()
    pointersViewerlistWidget.clear()
    stringEditorTextEdit.setPlainText("")
  }

  hiddenPointers=0
  let k =0
  while(Number(extractedPointers.length)>1){
    extractedPointersIn4[i] = extractedPointers.slice(0,4)

    if(extractedPointers.slice(0,4).toString("hex") != "00000000"){
      extractedPointersIn4Non0[k] = extractedPointers.slice(0,4)
      k=k+1
    }
    extractedPointers = extractedPointers.slice(4)

    
    const extractedItem = new QListWidgetItem()
    extractedItem.setText(`${extractedPointersIn4[i].toString("hex").toUpperCase()}`)
    
    pointersViewerlistWidget.addItem(extractedItem)

    if(extractedItem.text()==="00000000"&&pointersViewerButtonToHide00.isChecked()===true){
      extractedItem.setHidden(true)
      hiddenPointers = hiddenPointers+1;
    }

    i = i+1;
  }

  pointersViewerTitleLabel.setText(`Pointers Viewer (${extractedPointersIn4.length-hiddenPointers}) (${sharedPointers})`)

  extractedStrings = currentContent.slice(string1AddressDecimal,string2AddressDecimal)
  let extractedStringsTemp = currentContent.slice(string1AddressDecimal,string2AddressDecimal)


  i=0;


  rawStrings = [] //in hex, contains all 00
  textStrings = [] //in Unicode, without all the 00
  let phase =0;
  let tempString = []
  k = 0

  if(pointersTableMode===false){
    loop1:
    while(Number(extractedStringsTemp.length)!=0){
      k =0;
      phase = 0;
  
      loop2:
      while(phase<3){
  
        if(extractedStringsTemp[k] === 0){
        phase = 1
        
        }else if (phase === 1 && extractedStringsTemp[k] !=0){
  
          tempString = extractedStringsTemp.slice(0,k)
          extractedStringsTemp = extractedStringsTemp.slice(k)
  
        break loop2
        }
        k=k+1;
        if(extractedStringsTemp[k] === undefined){
          
          rawStrings[i] = extractedStringsTemp 
          break loop1
        }
      }
  
      rawStrings[i] = tempString
      i = i+1;
    }
  }else if(pointersTableMode===true){

    k =0;
    while (Number(extractedStringsTemp.length)!=0){
      if(extractedStringsTemp[k] === 0){
        rawStrings[i] = extractedStringsTemp.slice(0,k+1)
        extractedStringsTemp = extractedStringsTemp.slice(k+1)

        k =0
        i=i+1
      }if(extractedStringsTemp[k]!=0){
        break
      }
    }
    
    loop1:
    while(Number(extractedStringsTemp.length)!=0){
      k =0;
      phase = 0;
  
      loop2:
      while(phase<3){

        if(extractedStringsTemp[k] === 0){
        phase = 1

        
        }else if (phase === 1 && extractedStringsTemp[k] !=0){
  
  
          tempString = extractedStringsTemp.slice(0,k)
          extractedStringsTemp = extractedStringsTemp.slice(k)
      
        break loop2
        }
        k=k+1;
        if(extractedStringsTemp[k] === undefined){

          rawStrings[i] = extractedStringsTemp 

          break loop1
        }
      }

      rawStrings[i] = tempString
      i = i+1;
    }
  }

  i=0;

  while(rawStrings[i] != undefined){

    if(shiftJISEncoding===true){
      const conversion = EncodingModule.convert(rawStrings[i], {
        to: 'UNICODE',
        from: 'SJIS',
        });
    
        const convertedString = EncodingModule.codeToString(conversion)
        const extractedItem2 = new QListWidgetItem()
        extractedItem2.setText(`${convertedString}`)
        listWidget.addItem(extractedItem2)
    
        i = i+1;
    }else if(UTF8Encoding===true){
 
        const extractedItem2 = new QListWidgetItem()
        extractedItem2.setText(`${rawStrings[i]}`)
        listWidget.addItem(extractedItem2)

        i = i+1;
    }

  }

  extractedStringsOLD = Buffer.concat(rawStrings)
  originalExtractedStringsLength= extractedStringsOLD.length

  stringAddressFunc(currentContent)
  spaceLeftFunc(extractedStrings)
  pointerAddressFunc(currentContent)
  hexValuesFunc(currentContent)
  pointerAdjuster(currentContent)

  if(pointersTableMode===true){
    pointersTableUpdater()
  }else{
    saveConfiguration()
  }
}

//Similar to saveAndPrepare() but don't uses pointers addresses.
function saveAndPrepare2(){

  if(firstStringAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && lastStringAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && fs.existsSync(`${selectedFile}`) === true){
      console.log("Both string address are in a correct hex format!")
    }

  else{

    if(exportAllMode===false){
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText("Not correct hex format or invalid file path, aborting...")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
    }else{
      skipExport=true
    }
    return
  }


  let i = 0

  let string1Address = firstStringAddressLineEdit.text()
  let string2Address = lastStringAddressLineEdit.text()

  string1AddressDecimal= parseInt(string1Address,16)
  string2AddressDecimal = parseInt(string2Address,16)

  if(string1AddressDecimal>currentContent.length ||
  string2AddressDecimal>currentContent.length){
   
    if(exportAllMode===false){
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText("At least one string address is too big for this file x_x")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
      return
    }else{
      skipExport=true
    }

  }else if(string2AddressDecimal<string1AddressDecimal){
    errorMessageBox.setWindowTitle("Error")
  errorMessageBox.setText("Invalid string scheme, the first string address\nis greater than the first one")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return

  }else if(string2AddressDecimal===string1AddressDecimal){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Invalid string addresses, same addresses")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
    
  }

  setDefaultValues(2)
  csvButton.setEnabled(true)
  csvButton2.setEnabled(true)
  exportAllButton.setEnabled(true)
  extractedStrings = currentContent.slice(string1AddressDecimal,string2AddressDecimal)
  let extractedStringsTemp = currentContent.slice(string1AddressDecimal,string2AddressDecimal)

  i=0;
  rawStrings = [] //in hex, contains all 00
  textStrings = [] //in Unicode, without all the 00
  let phase =0;
  let tempString = []
  let k = 0


  loop1:
  while(Number(extractedStringsTemp.length)>1){

    k =0;
    phase = 0;

    loop2:
    while(phase<3){

      if(extractedStringsTemp[k] === 0){
      phase = 1

      }else if (phase === 1 && extractedStringsTemp[k] !=0){

        tempString = extractedStringsTemp.slice(0,k)
        extractedStringsTemp = extractedStringsTemp.slice(k)

      break loop2
      }
      k=k+1;

      if(extractedStringsTemp[k] === undefined){
        rawStrings[i] = extractedStringsTemp 
        break loop1
      }
    }

    rawStrings[i] = tempString
    i = i+1;
  }

  i=0;
  if(listWidget.item(i) != undefined) {
    listWidget.clear()
    stringEditorTextEdit.setPlainText("")
  }
  while(rawStrings[i] != undefined){

    if(shiftJISEncoding===true){
      const conversion = EncodingModule.convert(rawStrings[i], {
        to: 'UNICODE',
        from: 'SJIS',
        });
    
        const convertedString = EncodingModule.codeToString(conversion)
        const extractedItem2 = new QListWidgetItem()
        extractedItem2.setText(`${convertedString}`)
        listWidget.addItem(extractedItem2)
    
        i = i+1;
    }else if(UTF8Encoding===true){
  
        const extractedItem2 = new QListWidgetItem()
        extractedItem2.setText(`${rawStrings[i]}`)
        listWidget.addItem(extractedItem2)
    
        i = i+1;
    }

  }

  if(pointersViewerlistWidget.item(0)!=undefined){
    pointersViewerlistWidget.clear()

    pointersViewerTitleLabel.setText(`Pointers Viewer (Total) (Shared)`)
    pointersViewerButtonToHide00.setCheckState(0)
    pointersViewerButtonToHide00.setEnabled(false)
  }

  extractedStringsOLD = Buffer.concat(rawStrings)
  originalExtractedStringsLength= extractedStringsOLD.length
  stringAddressFuncWithoutPointers(currentContent,string1AddressDecimal,string2AddressDecimal)
  spaceLeftFunc(extractedStrings)
  saveConfiguration()
}

//Gather all the info to know the offset of each string in the file and in the memory 
//(the memory one is accurate only if the console uses pointers based in the total lenght of data in the RAM)
//data = currentContent, basically, the file.
function stringAddressFunc(data,start,end){

  let i = string1AddressDecimal;
  let phase = 0;
  let k = 0;
  let firstLetterFound= false
  //Analyze all the string indexes from currentContent
  //Saves the address/string index of each string start

  if(data[i]!=0){
    phase = 1;
    firstLetterFound= true
  }

  while(i != string2AddressDecimal){
    
    if(data[i] != 0 && phase === 1){

      addressOfEachString[k] = i.toString(16).toUpperCase();
      k=k+1;
      phase= 2;
      
    }else if(data[i] === 0 && phase===2){

      phase = 1
    }else if(data[i]===0&& phase === 0 &&pointersTableMode===true){

      addressOfEachString[k] = i.toString(16).toUpperCase();
      k=k+1;
      
      if(data[i+1]!=0&&firstLetterFound===false ){

      phase = 1
      firstLetterFound=true
      }
    }

    i=i+1;
  }

  //[First String Address in decimals]-[X String Address in decimals ]=
  //Difference
  //Difference+ [First string address in memory] = X String address in memory!

  //Format:String.

  let firstPointerW = pointersViewerlistWidget.item(0).text()

  if(bigEndian.isChecked()===true){

    addressOfEachStringInMemory[0] = firstPointerW

  }else{

    addressOfEachStringInMemory[0] = firstPointerW.match(/.{1,2}/g).reverse().join('') 
  
  }

  let firstPointerValuesInDecimals =""
  if(bigEndian.isChecked()===true){
    firstPointerValuesInDecimals = Buffer.from(firstPointerW, "hex").readUIntBE(0,Buffer.from(firstPointerW, "hex").length)
  }else{
    firstPointerValuesInDecimals = Buffer.from(firstPointerW, "hex").readUIntLE(0,Buffer.from(firstPointerW, "hex").length)
  }


  i = 1;
  k = 0;
  //This will be used to update the pointers later
  pointersHexValues[0] = extractedPointersIn4[0].toString("hex")


  while(pointersHexValues[k] != undefined){
    oldPointersHexValues[k] =  pointersHexValues[k]
    k=k+1;
  }

  while(addressOfEachString[i] != undefined){
  

    let differenceInDecimals = parseInt(addressOfEachString[i],16)-parseInt(addressOfEachString[0],16)
    let nextPointerInDecimals = firstPointerValuesInDecimals+differenceInDecimals;

    if(bigEndian.isChecked()===true){
      pointersHexValues[i] = nextPointerInDecimals.toString(16)
    }else{

    pointersHexValues[i] = nextPointerInDecimals.toString(16).padStart(firstPointerW.length, '0').match(/.{1,2}/g).reverse().join('') 
    
    }
    addressOfEachStringInMemory[i] = nextPointerInDecimals.toString(16).toUpperCase()

    k=0

    //Add 00 to the right or left side of pointer.
    if(pointersHexValues[i].length<extractedPointersIn4[0].toString("hex").length
    &&extractedPointersIn4[i]!= undefined){

      while(k<Math.trunc(extractedPointersIn4[i].toString("hex").length/2)){
        let left = false
        let right = false
  
        if(extractedPointersIn4[0].toString("hex")[k] ==="0"){
          left = true
        }
        
        if(extractedPointersIn4[0].toString("hex")[extractedPointersIn4[0].toString("hex").length-k-1] ==="0"){
          right = true
        }
  
        if(left === true && right === false){
          
          while(pointersHexValues[i].length<extractedPointersIn4[0].toString("hex").length){
            pointersHexValues[i] =  "0" + pointersHexValues[i]
          }
  
        }else if(left === false && right === true){
          
          while(pointersHexValues[i].length<extractedPointersIn4[0].toString("hex").length){
            pointersHexValues[i] = pointersHexValues[i]+ "0"
          }
        }
  
        k=k+1
      }
    }
    i=i+1
  }
}

//Similar to stringAddressFunc()
function stringAddressFuncWithoutPointers(data,start,end){
  let i = start;

  let phase = 0;
  let k = 0;
  addressOfEachString = []

  //Analyze all the string indexes from currentContent
  //Saves the address/string index of each string start
  while(i != end){

    if(data[i] != 0 && phase === 0){

      addressOfEachString[k] = i.toString(16).toUpperCase();
      k=k+1;
      phase= 1;
      
    }else if(data[i] === 0 && phase===1){

      phase = 0
    }
    i=i+1;
  }
  return addressOfEachString
}

//Determines all the space left that can be edited by analyzing the amount of 00 that 
//are in the specified offset.
function spaceLeftFunc(data){
  numSpaceLeft = 0
  let i = 0

  if(pointersTableMode===false){

    while(data[i] != undefined){
  
      if(data[i] === 0){
        numSpaceLeft= numSpaceLeft+1
      }
      i=i+1
    }

    numSpaceLeft = numSpaceLeft -addressOfEachString.length
    spaceLeftLabel.setText(`Space left: ${numSpaceLeft+1}`)
  }else if(pointersTableMode===true){
    let k = 0;
    while(globalExtractedStrings[k]!=undefined){
      i=0
      while(globalExtractedStrings[k][i] != undefined){
  
        if(globalExtractedStrings[k][i] === 0){
          numSpaceLeft= numSpaceLeft+1
        }
        i=i+1
      }
      k=k+1;
    }
    i=0
    while(globalAddressOfEachString[i]!=undefined){
      numSpaceLeft = numSpaceLeft -globalAddressOfEachString[i].length
      i=i+1
    }
    spaceLeftLabel.setText(`Global Space Left: ${numSpaceLeft+1}`)
  }
  
}

//Saves the address of each pointer to be used later.
function pointerAddressFunc(data){

  let i = pointer1AddressDecimal;
  let k = 0;

  while(i < pointer2AddressDecimal){

    addressOfEachPointer[k]= i
    k=k+1
    i=i+4;
  }
}

//Determines the pointers that must be edited by comparing the new ones with the old ones.
function hexValuesFunc(data){
let i = 1;
let phase=0;

  while(oldPointersHexValues[i] != undefined){

    if(pointersHexValues[i]!=oldPointersHexValues[i]){
  
      let oldPointersHexValuesRaw = Buffer.from(oldPointersHexValues[i].toString("hex").toUpperCase(), "hex")
      let pointersHexValuesRaw = Buffer.from(pointersHexValues[i].toString("hex").toUpperCase(), "hex")

      let s= 0

      while(extractedPointersIn4[s]!= undefined){

        if(Buffer.compare(extractedPointersIn4[s],oldPointersHexValuesRaw)=== 0){

          extractedPointersIn4[s] = Buffer.from(pointersHexValuesRaw.toString("hex") + "5B506F743474305D","hex")

          if(phase===0){

            phase=1
          }
        }
        s= s+1;
      }

      phase=0
    }
    i=i+1;
  }

  i =0
  //Removing [POT4T0]
  while(extractedPointersIn4[i]!=undefined){
    if(extractedPointersIn4[i].toString("hex").toUpperCase().includes("5B506F743474305D") ===true){
      extractedPointersIn4[i] = Buffer.from(extractedPointersIn4[i].toString("hex").toUpperCase().replace("5B506F743474305D",""),"hex")
    }
    i=i+1
  }

  //Updating the pointers viewer label
  pointersViewerTitleLabel.setText(`Pointers Viewer (${extractedPointersIn4.length-hiddenPointers}) (${sharedPointers})`)
}

//Updates currentContent and pointers viewer list widget with the new pointer values.
function pointerAdjuster(data){
  let i = 0;

  extractedPointers = Buffer.concat(extractedPointersIn4)

  let tempCurrentContent = data.toString("binary")
  let tempExtractedPointers = extractedPointers.toString("binary")

  tempCurrentContent = tempCurrentContent.substring(0,pointer1AddressDecimal) + tempExtractedPointers  + tempCurrentContent.substring(pointer2AddressDecimal)
  currentContent = Buffer.from(tempCurrentContent, "binary")
  i = 0;
  while(extractedPointersIn4[i] != undefined){

    if(pointersViewerlistWidget.item(i).text() !=extractedPointersIn4[i].toString("hex").toUpperCase()){

      pointersViewerlistWidget.item(i).setText(`${extractedPointersIn4[i].toString("hex").toUpperCase()}`)  

    }

    i=i+1;
  }

  

}

//Save your progress when edit a string.
//Before make the saves does some modifications to add or remove data to ensure that the defined
//area of strings that will be edited don't be bigger or lesser than the original one on the original file.
function saveProgress(options,replacement){
  if(options===1){

  }else if(listWidget.currentRow() === -1||stringEditorTextEdit.toPlainText()===""){
    return
  }

  if(options ===1){

    savedString = replacement
    let tempEncode = savedString.toString("utf8")
    listWidget.currentItem().setText(tempEncode)
    
  }else{

    listWidget.currentItem().setText(stringEditorTextEdit.toPlainText())

    if(shiftJISEncoding===true){
      const conversion = EncodingModule.convert(listWidget.currentItem().text(), {
        to: 'SJIS',
        from: 'UNICODE',
      });
      savedString = Buffer.from(conversion, "binary")
    }else if(UTF8Encoding===true){
      savedString = Buffer.from(listWidget.currentItem().text())
    }
  }

  let newBuffer = Buffer.alloc(1)
  savedString = Buffer.concat([savedString,newBuffer])

  if(pointer1AddressDecimal=== ""){
    while(rawStrings[listWidget.currentRow()].length>savedString.length){

      savedString = Buffer.concat([savedString,newBuffer])
      
    }
  }else{
    while(rawStrings[listWidget.currentRow()].length<savedString.length){
  
      rawStrings[listWidget.currentRow()] = Buffer.concat([rawStrings[listWidget.currentRow()],newBuffer])
      // console.log("Adding 00 to rawString nro" + ` ${listWidget.currentRow()}` +` ${rawStrings[listWidget.currentRow()].length-savedString.length}`)
    }
  }

  if(pointer1AddressDecimal=== ""){
    oldRawString =  rawStrings[listWidget.currentRow()]
  }
  
    rawStrings[listWidget.currentRow()] = savedString
    extractedStrings = Buffer.concat(rawStrings)
  if(extractedStrings.length>extractedStringsOLD.length){
    extractedStringsOLD = Buffer.concat(rawStrings)
    // console.log("Updating extractedStringsOLD")
  }


  if(pointer1AddressDecimal=== ""){
    while(rawStrings[listWidget.currentRow()].length>oldRawString.length){
      
      rawStrings[listWidget.currentRow()] = rawStrings[listWidget.currentRow()].slice(0,-1)
  
      if(rawStrings[listWidget.currentRow()].length===oldRawString.length){
        
        rawStrings[listWidget.currentRow()] = rawStrings[listWidget.currentRow()].slice(0,-1)
        rawStrings[listWidget.currentRow()] = Buffer.concat([rawStrings[listWidget.currentRow()],newBuffer])
       
      }
    }

    listWidget.item(listWidget.currentRow()).setText(rawStrings[listWidget.currentRow()].toString("utf8"))
    stringEditorTextEdit.setPlainText(rawStrings[listWidget.currentRow()].toString("utf8"))
    extractedStrings = Buffer.concat(rawStrings)
  }else{

    if(pointersTableMode===false){
      while(extractedStrings.length>originalExtractedStringsLength){
        extractedStrings = extractedStrings.slice(0,-1)
        if(extractedStrings.length===originalExtractedStringsLength){
          extractedStrings = extractedStrings.slice(0,-1)
          extractedStrings = Buffer.concat([extractedStrings,newBuffer])
        }
      }
    }
  }
  i = 1


// This while is a debug feature, if for some reason there are two raw pointers
//equals one after another it will trigger a console.log
//there can be false positives tho.
  // while(extractedPointersIn4[i] != undefined){
  //   let tempRawStringPast= ""
  //   let tempRawStringFuture= ""
  //   k=-1
  //   if(extractedPointersIn4[i].toString("hex") != "00000000"){

  //     while(extractedPointersIn4[k+i].toString("hex") !=undefined){

  //       if(extractedPointersIn4[k+i].toString("hex") !="00000000"){
  //         tempRawStringPast = extractedPointersIn4[k+i]
  //         pastPoint=k+i
  //         break
  //       }else{

  //       }
  //       k=k-1;
  //     }
  //     k =1
  //     while(extractedPointersIn4[i+k] !=undefined){

  //       if(extractedPointersIn4[i+k].toString("hex") !="00000000"){
  //         tempRawStringFuture = extractedPointersIn4[i+k]
  //         futurePoint=k+i
  //         break
  //       }
  //       k=k+1;
  //     }

  //     k=1
  //     if(tempRawStringPast.toString("hex")!=extractedPointersIn4[i].toString("hex")
  //        &&tempRawStringFuture.toString("hex")!=extractedPointersIn4[i].toString("hex")){

  //     }else if(tempRawStringPast.toString("hex")===extractedPointersIn4[i].toString("hex")
  //        &&extractedPointersIn4[i].toString("hex")!= tempRawStringFuture.toString("hex")){
         
  //         while(pointersHexValues[k]!=undefined){

  //           if(pointersHexValues[k-1].toUpperCase() === tempRawStringPast.toString("hex").toUpperCase()
  //           &&pointersHexValues[k].toUpperCase() != extractedPointersIn4[i].toString("hex").toUpperCase() ){


  //           }else if(pointersHexValues[k-1].toUpperCase() != tempRawStringPast.toString("hex").toUpperCase()
  //           &&pointersHexValues[k].toUpperCase() === extractedPointersIn4[i].toString("hex").toUpperCase() ){

  //           }

  //           k=k+1
  //         }

  //     }else if(tempRawStringFuture.toString("hex")===extractedPointersIn4[i].toString("hex")
  //        && extractedPointersIn4[i].toString("hex")!=tempRawStringPast.toString("hex")){
  //     }
  //   }
  //   i=i+1
  // }

  while(extractedStrings.length<extractedStringsOLD.length){

    extractedStrings = Buffer.concat([extractedStrings,newBuffer])
    // console.log("Adding 00 to extractedStrings" + ` ${String(extractedStrings.length-extractedStringsOLD.length)}`)
  }

  let tempCurrentContent = currentContent.toString("binary")
  let tempExtractedStrings = extractedStrings.toString("binary")
  string2AddressDecimal= parseInt(lastStringAddressLineEdit.text(),16)

  tempCurrentContent = tempCurrentContent.substring(0,string1AddressDecimal) + tempExtractedStrings  + tempCurrentContent.substring(string2AddressDecimal)

  oldcurrentContentLength = currentContent.length
  currentContent = Buffer.from(tempCurrentContent, "binary")

  if(pointersTableMode===true &&currentContent.length>oldcurrentContentLength&&fileSizeMenuAction1.isChecked()===true){
    let howMuchToCut = currentContent.length-oldcurrentContentLength
    let currentContentBufferArr = []
    currentContentBufferArr[0] = currentContent.subarray(0,parseInt(postLastStringAddress,16)-1)
    currentContentBufferArr[1] = newBuffer
    currentContentBufferArr[2] = currentContent.subarray(parseInt(postLastStringAddress,16)+howMuchToCut)
    currentContent = Buffer.concat(currentContentBufferArr)

  }

  if(pointer1AddressDecimal=== ""&&pointersTableMode===false){

  spaceLeftFunc(extractedStrings)

  }else{
    stringAddressFunc(currentContent)
    spaceLeftFunc(extractedStrings)
    pointerAddressFunc(currentContent)
    hexValuesFunc(currentContent)
    pointerAdjuster(currentContent)
  }

  if(pointersTableMode===true){
    pointersTableUpdater()
    spaceLeftFunc(extractedStrings)
  }

  fs.writeFileSync(`${selectedFile}`,currentContent,{
    encoding: "binary",
    flag: "w",
    mode: 0o666
  },
  (err) => {
    if (err){
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText("ERROR! maybe the file is being used?")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
    }
    else {
      console.log("File written successfully\n");
    }
  })
}

//Save all the input data of the user on settings.cfg
function saveConfiguration(){

  let i = 0;

  while(Number(sectionNameNumber.text()) != i){


    if(Number(sectionNameNumber.text()) === i+1){
    console.log("Adding extra slots to config file")

      if (projectsConfHexArr[i] ===undefined){
        projectsConfHexArr[i]= Buffer.from(`${i+1}`).toString("hex") + "0d0a0d0a0d0a0d0a0d0a0d0a0d0a"
  
      }

      projectsConfHexArr[i] =Buffer.from(`${i+1}`).toString("hex") + "0d0a"

      if(sectionNameLineEdit.text()===""){
        projectsConfHexArr[i] = projectsConfHexArr[i] + "2a0d0a"
      
      }else{
  
        projectsConfHexArr[i] = projectsConfHexArr[i] + 
        Buffer.from(sectionNameLineEdit.text(), "utf8").toString("hex") + "0d0a"

      }

      if(firstPointerAddressLineEdit.text()=== ""
      &&lastPointerAddressLineEdit.text() ===""){
        projectsConfHexArr[i] = projectsConfHexArr[i] + "2a0d0a" + "2a0d0a"

      
      }else if(firstPointerAddressLineEdit.text() ===""
      &&lastPointerAddressLineEdit.text() != ""){
        projectsConfHexArr[i] = projectsConfHexArr[i] + "2a0d0a" + lastPointerAddressLineEdit.text()
      }else if(firstPointerAddressLineEdit.text() !=""
      &&lastPointerAddressLineEdit.text() === ""){
        projectsConfHexArr[i] = projectsConfHexArr[i] + firstPointerAddressLineEdit.text() + "2a0d0a"
      }
      
      else{
        projectsConfHexArr[i] = projectsConfHexArr[i] + 
        +Buffer.from(firstPointerAddressLineEdit.text(), "utf8").toString("hex") + "0d0a"
        +Buffer.from(lastPointerAddressLineEdit.text(), "utf8").toString("hex") + "0d0a"

      }

      projectsConfHexArr[i] = projectsConfHexArr[i] + 
      Buffer.from(firstStringAddressLineEdit.text(), "utf8").toString("hex") + "0d0a" +
      Buffer.from(lastStringAddressLineEdit.text(), "utf8").toString("hex") + "0d0a" +
      Buffer.from(filePathQLineEditRead.text(), "utf8").toString("hex") + "0d0a" 

      if(UTF8Encoding===true){
        projectsConfHexArr[i] = projectsConfHexArr[i] + 
        Buffer.from("0", "utf8").toString("hex") + "0d0a"
      }else if(shiftJISEncoding===true){
        projectsConfHexArr[i] = projectsConfHexArr[i] +
        Buffer.from("1", "utf8").toString("hex") + "0d0a"
      }

      if (projectsConfHexArr[i+1] ===undefined){
        projectsConfHexArr[i+1]= Buffer.from(`${i+2}`).toString("hex") + "0d0a0d0a0d0a0d0a0d0a0d0a0d0a"

      }
    }else if(Number(sectionNameNumber.text()) > i+1&& projectsConfHexArr[i+1] === undefined
     ||
     Number(sectionNameNumber.text()) > i+1 && projectsConfHexArr[i+1].split("0d0a").length<4){
      
       console.log("No more space, adding more")
       projectsConfHexArr[(i+1)]=  Buffer.from(`${(i+2)}`).toString("hex") + "0d0a0d0a0d0a0d0a0d0a0d0a0d0a"
       if (projectsConfHexArr[i+2] ===undefined){
         projectsConfHexArr[i+2]= Buffer.from(`${i+3}`).toString("hex") +  "0d0a0d0a0d0a0d0a0d0a0d0a0d0a"
       }
   }
    i=i+1;

  }

  if(sectionNameLineEdit != ""){
    sectionNameHeader = sectionNameLineEdit.text()
    sectionDetailsLabel.setText(`${sectionNameHeader}: String#N/A`)
  }

  let toBeWrited = projectsConfHexArr.join("5b53504c49545d0d0a")

  fs.writeFile(`./settings.cfg`,`${Buffer.from(toBeWrited,"hex")}`,{
    encoding: "utf8",
    flag: "w",
    mode: 0o666
  },(err) => {
  
  if (err){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("ERROR! maybe the file is being used?")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()

  }

  else{

    console.log("Done!")

  }
  })
}

//Self-explanatory.
function setDefaultValues(options){

  if (options===1){

  }else if(options===2){  
  pointer1AddressDecimal= ""
  pointer2AddressDecimal = ""
  }else if(options ===3){

    sectionedCurrentContent = []
    selectedTablePointers = []
    extractedTablePointersRaw = []
    extractedTablePointersIn4 = []
    extractedTablePointersIn4Non0 = []
    tableStartPointerFileAddresses = []
    tableEndPointerStartStringFileAddresses = []
    tableEndStringFileAddresses = []
    pointersTableModeSettingsArr = []
    currentTableContent = []
    organizedSections = []
    oldSelectedTablePointers = []
    sectionNameNumber.setText(1)
  }else{
    sectionNameLineEdit.setText("")
    firstPointerAddressLineEdit.setText("")
    lastPointerAddressLineEdit.setText("")
    firstStringAddressLineEdit.setText("")
    lastStringAddressLineEdit.setText("")
    currentContent = ""
    selectedFile = ""
    addressOfEachPointer = []
    bigEndian.setCheckState(0)
  }

  stringsArr = []
  textToSearchOld = ""
  searchSet = 0
  textToSearch = ""
  matchSearch = []
  match = false
  rawStrings = [] //in hex, contains all 00
  extractedStrings = []
  // string1AddressDecimal= ""
  // string2AddressDecimal = ""
  extractedStringsOLD = ""
  numSpaceLeft = 0
  addressOfEachString = []
  pointersHexValues = []
  addressOfEachStringInMemory= []
  extractedPointersIn4= []
  extractedPointers = ""
  oldPointersHexValues = []
  savedString = ""
  // projectsConfHexArr = []
  oldRawString = ""
  oldSelectedString = -1
  sharedPointers = 0
  oldMatchedSharedPointers = []

  hiddenPointers = 0
  stringsOffset = 0
  stringsOldOffset = 0

  listWidget.clear()
  listWidget.scrollToTop()
  pointersViewerlistWidget.clear()
  pointersViewerlistWidget.scrollToTop()
  exportAllButton.setEnabled(false)
  csvButton.setEnabled(false)
  csvButton2.setEnabled(false)
  pointersViewerButtonToHide00.setEnabled(false)
  pointersEditorRealocateButton.setEnabled(false)
  pointersEditorSaveButton.setEnabled(false)
  pointersEditorLabel.setEnabled(false)
  pointersEditor.setEnabled(false)
  pointersViewerForSharedPointersListWidget.setEnabled(false)
  mainMenuAction3.setEnabled(false)
  bigEndian.setEnabled(true)
  fastButton.setEnabled(true)

  stringEditorTextEdit.setPlainText("")

  if(pointersTableMode===false){
  sectionNameHeader= "Section name"
  }else{

  }

  sectionDetailsLabel.setText(`${sectionNameHeader}: String#N/A`)
  spaceLeftLabel.setText(`Space left: N/A`)
  pointerValuesLabel.setText(`Pointer HexValues: N/A`)
  pointerAddressLabel.setText("Pointer Address: N/A")
  stringAdressLabel.setText(`String Address: File/"RAM" (Not accurate)`)
  pointersViewerTitleLabel.setText(`Pointers Viewer (Total) (Shared)`)
  choosedCharacters.setText("")
  searchLineEdit.setText("")
}

//Takes the data from settings.cfg and add it into the lineEdits.
function loadConfiguration(){
  
  if(
     projectsConfHexArr[Number(sectionNameNumber.text()-1)] === undefined||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[0]) === '' ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[0]) === undefined ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[1]) === '' ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[1]) === undefined ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[2]) === '' ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[2]) === undefined ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[3]) === '' ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[3]) === undefined ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[4]) === '' ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[4]) === undefined ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[5]) === '' ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[5]) === undefined ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[6]) === '' ||
    (projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[6]) === undefined){

    console.log(`Not valid data for ${sectionNameNumber.text()}, hex spaces will be empty`)
    setDefaultValues()

    if(exportAllMode===true){
      stopExport =true
    }

    start()

  }else{
    setDefaultValues()
    console.log("Configuration loaded")
    sectionNameNumber.setText(Buffer.from(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[0], "hex").toString("utf8") + " ")
    
    

    if(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[1] === "2a"){
  
      sectionNameLineEdit.setText("")
      sectionDetailsLabel.setText(`Section name: String#N/A`)
      sectionNameHeader = "Section name:"
    }else{
      sectionNameLineEdit.setText(Buffer.from(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[1], "hex").toString("utf8"))
      sectionNameHeader = sectionNameLineEdit.text()

      sectionDetailsLabel.setText(`${sectionNameHeader}: String#N/A`)
    }

    if(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[2] === "2a"){

      firstPointerAddressLineEdit.setText("")
    }else{
      firstPointerAddressLineEdit.setText(Buffer.from(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[2], "hex").toString("utf8"))
    }

    if(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[3] === "2a"){

      lastPointerAddressLineEdit.setText("")
    }else{
      lastPointerAddressLineEdit.setText(Buffer.from(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[3], "hex").toString("utf8"))
    }

  
    firstStringAddressLineEdit.setText(Buffer.from(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[4], "hex").toString("utf8"))
    
    lastStringAddressLineEdit.setText(Buffer.from(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[5], "hex").toString("utf8"))
    filePathQLineEditRead.setText(Buffer.from(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[6], "hex").toString("utf8"))
    selectedFile = [`${`${Buffer.from(projectsConfHexArr[Number(sectionNameNumber.text()-1)].split("0d0a")[6], "hex").toString("utf8")}`}`]
    start()
    
  }
}

// +1 to sectionNameNumber
function plus1(tableMode,options){

  if(tableMode===false){
    if(sectionNameNumber.text() === "255 "){
      return
    }
    if(exportAllModeVariable===0){
      sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
      loadConfiguration()

    }else if(options>1&&exportAllModeVariable===2){
      sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
      loadConfiguration()
      saveAndPrepare()

    }else if(options>1&&exportAllModeVariable===1){
      sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
      loadConfiguration()
      saveAndPrepare2()
    }

  }else{
    if(sectionNameNumber.text() === `${sectionedCurrentContent.length} `){
      return
    }
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
    loadPTConfiguration()
  }
}

// -1 to sectionNameNumber
function minus1(tableMode){

  if(sectionNameNumber.text() === "1 "){
    return
  }
  if(tableMode===false){
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())-1}` + " ")
    loadConfiguration()
  }else{
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())-1}` + " ")

    loadPTConfiguration()
  }
}

function goToStart(){

  sectionNameNumber.setText(1 + " ")

  if(pointersTableMode===false){
    loadConfiguration()
  }else if(pointersTableMode===true){
    loadPTConfiguration()
  }
}

//Rearrange the text in the string editor with a character limit per line
function specificCharactersPerLine(x){
  if(choosedCharacters.text() === ""||choosedCharacters.text() <=0
  ||x=== undefined){
    return
  }

  let choosedLength = choosedCharacters.text()
  let rawText = stringEditorTextEdit.toPlainText()
  rawText = rawText.replaceAll("\n","")

  if(rawText.length>choosedLength){
    let charactersArr = []
    let i = 0
    while(rawText.length>0){

      if(rawText.length>choosedLength){
        charactersArr[i] = rawText.slice(0,choosedLength) + "\n"
      }else{
        charactersArr[i] = rawText.slice(0,choosedLength)
      }
      rawText = rawText.slice(choosedLength)
      i=i+1;
    }
    //The QTextCursor is neccesary to make this part work since i need to move the cursor to
    //the end of the text but that module has not been ported to nodegui yet :/ . This will
    //remain commented.
    // stringEditorTextEdit.removeEventListener("textChanged")

    stringEditorTextEdit.setPlainText(charactersArr.join(""))

    // if(autoCharaAdjust.isChecked()===true){
    //   stringEditorTextEdit.addEventListener("textChanged",function (){
    //     specificCharactersPerLine(0)
    //   })
    // }
  }
}

function csvSelection(){
  const csvFileDialog = new QFileDialog()
  csvFileDialog.setNameFilter("*.csv")
  csvFileDialog.setWindowTitle("Choose a .csv file")
  let selectedCsv
  let goBack = true
  csvFileDialog.addEventListener("fileSelected",function(){

    if(csvFileDialog.selectedFiles().length!=0&&
    fs.lstatSync(csvFileDialog.selectedFiles()[0]).isDirectory()===false&&
    path.extname(`${csvFileDialog.selectedFiles()[0].toLowerCase()}`)===".csv"){
  
      selectedCsv = csvFileDialog.selectedFiles();
      goBack=false
    }else{
  
      return null
    }

  })

  csvFileDialog.exec();

  if(goBack===true){
    return null
  }
  return selectedCsv
}

function csvTranslationPhase2(selectedCsv,options){

  let csvContent = fs.readFileSync(`${selectedCsv}`);

  let testCsvContent = csvContent.toString("hex").split("0d0a")
  testCsvContent[0] = testCsvContent[0].replace("efbbbf","")

  let i = 0;
  let nextBadSemicolonWillStopTheTest = true

  if(testCsvContent[0].includes("3b")===true){

  }else{
    errorMessageBox.setText(`Seems to be that your .csv file is not separated by
    semicolons, a .csv file separated by semicolons will be created in the root 
    folder, please try to use it.`)
    errorMessageBox.setWindowTitle("Error, check your '.csv' file")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()

    fs.writeFile(`./NewCsv.csv`,Buffer.from("EFBBBF48656C6C6F3B486F6C610D0A","hex"),{
      encoding: "utf8",
      flag: "w",
      mode: 0o666
    },(err) => {
  
      if (err){
        errorMessageBox.setWindowTitle("Error")
        errorMessageBox.setText("ERROR! .csv could not be created D:\n")
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
      }
      else{
        errorMessageBox.setWindowTitle("Error")
        errorMessageBox.setText(`New .csv created sucessfully`)
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
      }
    })
    return
  }

  while(testCsvContent[i] !=undefined){


    if(testCsvContent[i]==="3b"){

      nextBadSemicolonWillStopTheTest = true

    }else if(testCsvContent[i].substring(0,2)!="3b" &&testCsvContent[i].substring(testCsvContent[i].length-2)!="3b"){

      nextBadSemicolonWillStopTheTest = false

    }else if(testCsvContent[i].substring(0,2)==="3b" &&nextBadSemicolonWillStopTheTest === true){

      errorMessageBox.setText(`The text #${i+1} to be translated has not it\n translated counterpart.`)
      errorMessageBox.setWindowTitle("Error, check your .csv file")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
      return

    }else if(testCsvContent[i].substring(testCsvContent[i].length-2)==="3b"&&nextBadSemicolonWillStopTheTest === true){

      errorMessageBox.setText(`The replacement text #${i+1} has not it untranslated\ncounterpart.`)
      errorMessageBox.setWindowTitle("Error, check your .csv file")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
      return

    }
    i=i+1
  }
  testCsvContent=""


  i = 0
  let k = 0;
  let m = 0;
  let mode = 0;
  let replacementStrings = [] //Left column in CSV
  let stringToSearch = [] //Right Column in CSV
  csvBinaryString = csvContent.toString("hex")
 
  csvBinaryString = csvBinaryString.replaceAll("0d0a","0a")
  csvBinaryString = csvBinaryString.replace("efbbbf","")

  replacementStrings[0] = ""
  stringToSearch[0] = ""

  while(csvBinaryString[i] != undefined){

    if(mode ===0 && csvBinaryString[i] +csvBinaryString[i+1] != "3b" && csvBinaryString[i] +csvBinaryString[i+1] !="0a"){
      replacementStrings[k] = replacementStrings[k]+ csvBinaryString[i] + csvBinaryString[i+1]

    }else if (mode ===0 && csvBinaryString[i] +csvBinaryString[i+1] === "3b" || mode ===0 && csvBinaryString[i] +csvBinaryString[i+1] ==="0a"){
      k=k+1;
      replacementStrings[k] = ""
      mode =1;
    }else if(mode ===1 && csvBinaryString[i] +csvBinaryString[i+1] != "3b" &&csvBinaryString[i] +csvBinaryString[i+1] !="0a"){
      stringToSearch[m] = stringToSearch[m] +csvBinaryString[i] + csvBinaryString[i+1]

    }else if(mode ===1 && csvBinaryString[i] +csvBinaryString[i+1] === "3b"|| mode ===1 && csvBinaryString[i] +csvBinaryString[i+1] ==="0a"){
      m=m+1;
      stringToSearch[m] = ""
      mode =0;
    }
    i=i+2;
  }
  i = 0;
  k = 0;

  //English strings
  let replacementStringsTemp = []
  replacementStringsTemp[0] = ""
  let replacementStringsBuffer = []
  let iDontKnowWhyIneedToUseThis=   0

  while(replacementStrings[i] != undefined){

    iDontKnowWhyIneedToUseThis = replacementStrings[i]

    if(replacementStrings[i] === '' && replacementStringsTemp[k] != undefined){

      replacementStringsTemp[k] = replacementStringsTemp[k].substring(0,replacementStringsTemp[k].length-2)
      replacementStringsBuffer[k] = Buffer.from(replacementStringsTemp[k],"hex")
      k= k+1
      replacementStringsTemp[k] =""
    }else{
      replacementStringsTemp[k] = replacementStringsTemp[k] + iDontKnowWhyIneedToUseThis + "0a"

    }

    i=i+1;
  }
  i = 0;
  k = 0;

  //Encoded Strings
  let stringToSearchTemp = []
  stringToSearchTemp[0] = ""
  let stringToSearchBuffer = []
  let iDontKnowWhyIneedToUseThis2= 0;


  while(stringToSearch[i] != undefined){

    iDontKnowWhyIneedToUseThis2 = stringToSearch[i]

    if(stringToSearch[i] === '' && stringToSearchTemp[k] != undefined){

      stringToSearchTemp[k] = stringToSearchTemp[k].substring(0,stringToSearchTemp[k].length-2)
      stringToSearchBuffer[k] = Buffer.from(stringToSearchTemp[k],"hex")
      k= k+1
      stringToSearchTemp[k] =""

    }else{
      stringToSearchTemp[k] = stringToSearchTemp[k] + iDontKnowWhyIneedToUseThis2 + "0a"
   
    }

    i=i+1;
  }
  i = 0;
  k = 0;

  let replacementStringsEncoded = []
  let replacementStringsEncodedBuffer = []

  while(replacementStringsBuffer[i]!= undefined){

    if(shiftJISEncoding ===true){
      replacementStringsEncoded[i] = EncodingModule.convert(replacementStringsBuffer[i].toString("utf8"), {
        to: 'SJIS',
        from: 'UNICODE',
      });

      replacementStringsEncoded[i] = replacementStringsEncoded[i].replaceAll('"."','."')
      replacementStringsEncoded[i] = replacementStringsEncoded[i].replaceAll('"."','."')
      replacementStringsEncoded[i] = replacementStringsEncoded[i].replaceAll('"""','""')
      replacementStringsEncoded[i] = replacementStringsEncoded[i].replaceAll('""','"')
      replacementStringsEncodedBuffer[k] = Buffer.from(replacementStringsEncoded[i], "binary")
      if(replacementStringsEncoded[i] === ''){
  
        k= k-1;
      }
      k=k+1;
      i=i+1;
    }else if(UTF8Encoding===true){

      replacementStringsEncoded[i] = replacementStringsBuffer[i].toString("utf8")
      replacementStringsEncoded[i] = replacementStringsEncoded[i].replaceAll('"."','."')
      replacementStringsEncoded[i] = replacementStringsEncoded[i].replaceAll('"."','."')
      replacementStringsEncoded[i] = replacementStringsEncoded[i].replaceAll('"""','""')
      replacementStringsEncoded[i] = replacementStringsEncoded[i].replaceAll('""','"')
      replacementStringsEncodedBuffer[k] = Buffer.from(replacementStringsEncoded[i])
      if(replacementStringsEncoded[i] === ''){
  
        k= k-1;
      }
      k=k+1;
      i=i+1;
    }

  }

  i = 0;
  k=0;
  let stringToSearchEncoded = []
  let stringToSearchEncodedBuffer = []

  while(stringToSearchBuffer[i]!= undefined){

    if(shiftJISEncoding===true){
      stringToSearchEncoded[i] = EncodingModule.convert(stringToSearchBuffer[i].toString("utf8"), {
        to: 'SJIS',
        from: 'UNICODE',
      });
  
      stringToSearchEncodedBuffer[k] = Buffer.from(stringToSearchEncoded[i], "binary")
      if(stringToSearchEncoded[i] === ''){
        k= k-1;
      }
      k= k+1;
      i=i+1;
    }else if(UTF8Encoding===true){

      stringToSearchEncoded[i] = stringToSearchBuffer[i].toString("utf8")
      stringToSearchEncodedBuffer[k] = Buffer.from(stringToSearchEncoded[i])

      if(stringToSearchEncoded[i] === ''){
        k= k-1;
      }
      k= k+1;
      i=i+1;
    }

  }


  if(replacementStringsEncodedBuffer[replacementStringsEncodedBuffer.length-1].toString("hex").length===0){
    replacementStringsEncodedBuffer.pop()
  }else if(stringToSearchEncodedBuffer[stringToSearchEncodedBuffer.length-1].toString("hex").length===0){
    stringToSearchEncodedBuffer.pop()
  }

  if(replacementStringsEncodedBuffer.length != stringToSearchEncodedBuffer.length){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("The csv contains strings without a translation or text to be translated")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }
  csvTranslationMode = true

foundAndReplaceIfMatch(replacementStringsEncodedBuffer,stringToSearchEncodedBuffer,options)
}

//Organize the data from the csv given by the user, saving them in
//replacementStringsInShiftJisBuffer and stringToSearchInShiftJisBuffer.
function csvTranslation(options){

  const csvTranslationDialog = new QDialog()
  const csvTranslationRow = new QWidget()

  const csvTranslationDialogLayout = new QBoxLayout(2)
  const csvTranslationRowLayout = new QBoxLayout(0)

  csvTranslationRow.setLayout(csvTranslationRowLayout)
  csvTranslationDialog.setFixedSize(300,80)

  csvTranslationDialog.setLayout(csvTranslationDialogLayout)
  csvTranslationDialog.setModal(true)

  csvTranslationDialogLayout.addWidget(csvTranslationRow)

  csvTranslationDialog.setWindowTitle("Select one translation option")

  const csvTranslationForThisSection = new QPushButton()
  const csvTranslationForThisPT = new QPushButton()

  csvTranslationForThisSection.setText("Strings in this section")
  csvTranslationForThisPT.setText("Strings from .pt file")

  csvTranslationRowLayout.addWidget(csvTranslationForThisSection)
  csvTranslationRowLayout.addWidget(csvTranslationForThisPT)

  csvTranslationForThisSection.addEventListener("clicked", function(){
    csvTranslationDialog.close()
    let selectedCsv = csvSelection()

    if(selectedCsv===null){
      return
    }
    
    csvTranslationPhase2(selectedCsv,options)
  })

  csvTranslationForThisPT.addEventListener("clicked", function(){
    csvTranslationDialog.close()
    let selectedCsv = csvSelection()

    if(selectedCsv===null){
      return
    }
    goToStart()
    let k =0

    while(k!=sectionedCurrentContent.length){
      
      csvTranslationPhase2(selectedCsv,options)

      plus1(pointersTableMode)

      k=k+1
    }
  })

  csvTranslationDialog.exec()
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const tests2 = new QDialog()
const tests2Q = new QLineEdit()
const testsFB = new FlexLayout()
tests2.setLayout(testsFB)
testsFB.addWidget(tests2Q)
tests2.setWindowTitle("Test")
tests2.setFixedSize(200,200)


//Uses the data from  and stringToSearchInShiftJisBuffer/searchStrings
//to search for matches in currentContent, if found any, substitute it with the
//translated text in replacementStringsInShiftJisBuffer/replaceStrings.
async function foundAndReplaceIfMatch(replaceStrings,searchStrings,options){
  let lastCsvTranslationLogOriginal = []
  let lastCsvTranslationLogReplacement = []
  let lastCsvTranslationLogReplacementClean = []

  let i = 0;
  let k = 0;
  if(options===1){

    while(rawStrings[i] != undefined){

      while(replaceStrings[k]!= undefined){

        if(rawStrings[i].toString("hex").includes(searchStrings[k].toString("hex")) === true 
        && searchStrings[k].toString("hex") != ""){

            let tempReplaceString = rawStrings[i].toString("hex").replaceAll(`${searchStrings[k].toString("hex")}`,`${replaceStrings[k].toString("hex")}`)
            tempReplaceString = Buffer.from(tempReplaceString,"hex")

            if(fastButton.isChecked()===true){

            }else{

              errorMessageBox.setWindowTitle("Task in progress, please wait")
              errorMessageBox.setText(`The string #${i+1} in this section of the file \nmatch with the csv string #${k+1}\ntranslating to:\n\n${replaceStrings[k]}`)
              errorMessageButton.setText("                                                Ok                                              ")
              errorMessageBox.show()
              await sleep(150);
            }

          lastCsvTranslationLogReplacement[i] = tempReplaceString.toString("utf8").replace(/\x00\x00/g, '[CHECK]')
          lastCsvTranslationLogReplacementClean[i] = tempReplaceString.toString("utf8").replace(/\x00/g,"")
          lastCsvTranslationLogOriginal[i] = rawStrings[i].toString("utf8")

          listWidget.setCurrentRow(i)
          saveProgress(1,tempReplaceString)
        }
  
        k=k+1;
      }
  
      k=0;
      i=i+1;

    }
  }else{
    while(rawStrings[i] != undefined){

      while(replaceStrings[k]!= undefined){
        let tempSearchString= searchStrings[k].toString("hex")
  
        if(rawStrings[i].length>Buffer.from(searchStrings[k].toString("hex").replaceAll("0a200a","0a0a"),"hex").length){
          while(tempSearchString.replaceAll("0a200a","0a0a").length<rawStrings[i].toString("hex").length){
            tempSearchString= tempSearchString +"00"
          }
        }
  
        if(rawStrings[i].toString("hex").includes(searchStrings[k].toString("hex").replaceAll("0a200a","0a0a")+"00") === true 
          && searchStrings[k].toString("hex") != ""
          && rawStrings[i].toString("hex")===tempSearchString.replaceAll("0a200a","0a0a")){
        
            if(fastButton.isChecked()===true){

            }else{
          
              errorMessageBox.setWindowTitle("Task in progress, please wait")
              tests2Q.setText(`The string #${i+1} in this section of the file \nmatch with the csv string #${k+1}\ntranslating to:\n\n${replaceStrings[k]}`)
              tests2.show()
              await sleep(350);
              tests2.close()
            }

          lastCsvTranslationLogReplacement[k]= replaceStrings[k].toString("utf8").replace(/\x00\x00/g,"[CHECK]")
          lastCsvTranslationLogReplacementClean[k] = replaceStrings[k].toString("utf8").replace(/\x00/g,"")
          lastCsvTranslationLogOriginal[k] = searchStrings[k].toString("utf8")


          listWidget.setCurrentRow(i)
          saveProgress(1,replaceStrings[k])
        }
  
        k=k+1;
      }
  
      k=0;
      i=i+1;


    }
    if(pointer1AddressDecimal!="" &&csvTranslationMode===true){
      console.log("csv Transladion end 1")
      csvTranslationMode = false
      let rawLenght1 = rawStrings.length
      saveAndPrepare()
      let rawLenght2 = rawStrings.length

      if(rawLenght1>rawLenght2){
        errorMessageBox.setText(`The process ended with fewer strings compared to when it\nstarted, please double-check the last strings and\npointers there are maybe some pointers duplicated.`)
        errorMessageBox.setWindowTitle("Warning, check your last pointers/strings")
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
      }

    }else if(pointer1AddressDecimal==="" &&csvTranslationMode===true){
      console.log("csv Transladion end 2")
      csvTranslationMode = false
      let rawLenght1 = rawStrings.length
      saveAndPrepare2()
      let rawLenght2 = rawStrings.length

      if(rawLenght1>rawLenght2){
        errorMessageBox.setText(`The process ended with fewer strings compared to when it\nstarted, please double-check the last strings and\npointers there are maybe some pointers duplicated.`)
        errorMessageBox.setWindowTitle("Warning, check your last pointers/strings")
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
      }
    }
  }



  const duplicates = lastCsvTranslationLogReplacementClean.filter((item, index) => index !== lastCsvTranslationLogReplacementClean.indexOf(item))

  if(lastCsvTranslationLogReplacementClean.length-duplicates.length!=lastCsvTranslationLogReplacement.length){

    let needsCheck = lastCsvTranslationLogReplacement.filter((replacement) => replacement.includes("[CHECK]"))

    needsCheck = needsCheck.map(function(x) {return x.replace(/\x00/g,"")})
    needsCheck = needsCheck.map(function(x) {return x.replace("[CHECK]","")})

    if(needsCheck.length!=0&&duplicates.length===0){
      errorMessageBox.setWindowTitle("Warning")
      errorMessageBox.setText(`The following string(s) were translated at least\ntwo times, maybe they need a manual check\n\n${needsCheck.join(";").replaceAll(";","\n\n")}`)
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.show()
      return
    }else if(needsCheck.length===0&&duplicates.length!=0){
      errorMessageBox.setWindowTitle("Warning")
      errorMessageBox.setText(`The following string(s) are duplicated, they\nneed a manual check\n\n${duplicates.join(";").replaceAll(";","\n\n")}`)
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.show()
      return
    }else{
      errorMessageBox.setWindowTitle("Warning")
      errorMessageBox.setText(`The following string(s) were translated at least\ntwo times, maybe they need a manual check\n\n${needsCheck.join(";").replaceAll(";","\n\n")}\n\nThe following string(s) are duplicated, they\nneed a manual check\n\n${duplicates.join(";").replaceAll(";","\n\n")}`)
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.show()
      return
    }
  }
  
  await sleep(300);

  errorMessageBox.setWindowTitle("Task completed")
  errorMessageBox.setText(`Task Completed`)
  errorMessageButton.setText("                                                Ok                                              ")
  errorMessageBox.show()
}

function exportAllSelection(){

  const exportAllSelectionDialog = new QDialog()
  const exportAllSelectionRow1 = new QWidget()
  const exportAllSelectionMiddleRow = new QWidget()
  const exportAllSelectionRow2 = new QWidget()
  const exportAllSelectionDialogLayout = new QBoxLayout(2)
  const exportAllSelectionRow1Layout = new QBoxLayout(0)
  const exportAllCheckButton = new QCheckBox()
  const exportAllSelectionRow2Layout = new QBoxLayout(0)
  const exportAllSelectionMiddleRowLayout = new QBoxLayout(0)

  exportAllSelectionRow1.setLayout(exportAllSelectionRow1Layout)
  exportAllSelectionRow2.setLayout(exportAllSelectionRow2Layout)
  exportAllSelectionMiddleRow.setLayout(exportAllSelectionMiddleRowLayout)

  exportAllSelectionDialog.setFixedSize(300,160)

  exportAllSelectionDialog.setLayout(exportAllSelectionDialogLayout)
  exportAllSelectionDialog.setModal(true)

  exportAllSelectionDialog.setWindowTitle("Select one export option")
  exportAllCheckButton.setText("Add Section name")
  exportAllCheckButton.setCheckState(2)
  exportAllCheckButton.setToolTip("It will add the section name of each group of data.")

  const exportAllSelectionStringsButton = new QPushButton()
  const exportAllSelectionStringsAndMoreButton = new QPushButton()

  exportAllSelectionRow1Layout.addWidget(exportAllSelectionStringsButton)
  exportAllSelectionRow1Layout.addWidget(exportAllSelectionStringsAndMoreButton)
  exportAllSelectionMiddleRowLayout.addWidget(exportAllCheckButton,0,132)

  if(pointersTableMode===false){

    const exportAllSelectionAllStringsButton = new QPushButton()
    const exportAllSelectionAllStringsAndMoreButton = new QPushButton()
    
    exportAllSelectionRow2Layout.addWidget(exportAllSelectionAllStringsButton)
    exportAllSelectionRow2Layout.addWidget(exportAllSelectionAllStringsAndMoreButton)

    exportAllSelectionDialogLayout.addWidget(exportAllSelectionRow1)
    exportAllSelectionDialogLayout.addWidget(exportAllSelectionMiddleRow)
    exportAllSelectionDialogLayout.addWidget(exportAllSelectionRow2)



    exportAllSelectionStringsAndMoreButton.addEventListener("clicked",function (){
      exportAll(0,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionStringsButton.addEventListener("clicked",function (){
      exportAll(1,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })

    exportAllSelectionAllStringsButton.addEventListener("clicked",function (){
      exportAll(2,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionAllStringsAndMoreButton.addEventListener("clicked",function (){
      exportAll(3,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })

    win.addEventListener("Close", function (){
      exportAllSelectionDialog.close(true)
    })

    exportAllSelectionStringsButton.setText("Strings of this section")
    exportAllSelectionStringsButton.setToolTip("Exports all the Strings found in this section\nof the file using this configuration.")
   
    exportAllSelectionAllStringsButton.setText("Strings of all sections")
    exportAllSelectionAllStringsButton.setToolTip("Exports all the strings found in all sections.\nWarning: Be sure that all the sections are properly set up")
    
    exportAllSelectionStringsAndMoreButton.setText("All of this section")

    exportAllSelectionAllStringsAndMoreButton.setText("All data from sections")
    if(pointer1AddressDecimal === ""){

      exportAllSelectionStringsAndMoreButton.setToolTip("Exports all the Strings and their Address found in this section\nof the file using this configuration.")
      
      exportAllSelectionAllStringsAndMoreButton.setToolTip("Exports all the strings and Address found in all sections.\nWarning: Be sure that all the sections are properly set up")
    }else{

      exportAllSelectionStringsAndMoreButton.setToolTip("Exports all the Strings, Pointers, etc found in this section\nof the file using this configuration.")
      
      exportAllSelectionAllStringsAndMoreButton.setToolTip("Exports all the Strings, Pointers, etc found in all sections.\nWarning: Be sure that all the sections are properly set up")
    }

    exportAllSelectionDialog.exec()  

  }else if(pointersTableMode===true){

    exportAllSelectionRow2.setLayout(exportAllSelectionRow2Layout)
    const exportAllSelectionStringsInFolderButton = new QPushButton()
    const exportAllSelectionAllInFolderButton = new QPushButton()
  
    exportAllSelectionRow2Layout.addWidget(exportAllSelectionStringsInFolderButton)
    exportAllSelectionRow2Layout.addWidget(exportAllSelectionAllInFolderButton)
  
    exportAllSelectionDialogLayout.addWidget(exportAllSelectionRow1)
    exportAllSelectionDialogLayout.addWidget(exportAllSelectionRow2)
    
    exportAllSelectionStringsButton.setText("Strings of this .pt")
    exportAllSelectionStringsButton.setToolTip("Exports all the Strings of the current Pointers Table.")
    
    exportAllSelectionStringsAndMoreButton.setText("All on this .pt")
    exportAllSelectionStringsAndMoreButton.setToolTip("Exports all the Strings, Pointers, etc on this Pointers Table.")
    
    exportAllSelectionStringsInFolderButton.setText("Strings in all .pt files")
    exportAllSelectionStringsInFolderButton.setToolTip("Export all the strings on all the Pointers Tables found\n in the Pointers Tables folder.\nWarning: Be sure that all the tables works without errors.")
    
    exportAllSelectionAllInFolderButton.setText("All")
    exportAllSelectionAllInFolderButton.setToolTip("All")
  
    exportAllSelectionStringsAndMoreButton.addEventListener("clicked",function (){
      exportAll(0,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionStringsButton.addEventListener("clicked",function (){
      exportAll(1,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionStringsInFolderButton.addEventListener("clicked",function(){
      exportAll(2,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionAllInFolderButton.addEventListener("clicked",function(){
      exportAll(3,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    win.addEventListener("Close", function (){
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionDialog.exec()
  }
  
}

function exportOnlyStringsOfSection(dataToExport,addFileName){
  let i = 0

  if(addFileName===true){
    dataToExport = dataToExport + sectionNameLineEdit.text() + "\n\n"
  }
  while (rawStrings[i]!= undefined ){
  
    dataToExport = dataToExport + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n`
    
    i=i+1
  }
  return dataToExport
}

function exportStringsAndAddressOfSection(dataToExport,addFileName){
  
  if(addFileName===true){
    dataToExport = dataToExport + sectionNameLineEdit.text() + "\n\n"
  }

  let i = 0
  while (rawStrings[i]!= undefined ){
  
    dataToExport = dataToExport + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n`
    
    dataToExport = dataToExport + ";"

    dataToExport = dataToExport + addressOfEachString[i].toString("hex") + `\n\n`

    i=i+1
  }
  return dataToExport
}

function exportStringsFromAllSections(dataToExport,options,addFileName){
  
  dataToExport = []
  dataToExport[0] = Buffer.from("efbbbf0d0a", "hex")

  exportAllModeVariable = 1
  let i = 0
  exportAllMode =true
  let l =0
  goToStart()
  saveAndPrepare2()

  while(stopExport ===false){
    i= 0

    if(addFileName===true){
      dataToExport[l] = dataToExport[l] + sectionNameLineEdit.text() + "\n\n"
    }

    while (rawStrings[i]!= undefined &&skipExport===false){

      dataToExport[l] = dataToExport[l] + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n`
      
      i=i+1
    }
    if(skipExport===false){
      l=l+1
      dataToExport[l] = ""
    }

    // dataToExport[l] = String(dataToExport[l]).replaceAll("undefined","")
    skipExport=false
    plus1(pointersTableMode,options)
  }
  
  return dataToExport
}

function exportStringsAndAddressFromAllSections(dataToExport,options,addFileName){
  
  dataToExport = []
  dataToExport[0] = Buffer.from("efbbbf0d0a", "hex")

  exportAllModeVariable = 1

  let i = 0
  let l =0

  exportAllMode =true

  goToStart()
  saveAndPrepare2()

  while(stopExport ===false){
    i= 0

    if(addFileName===true){
      dataToExport[l] = dataToExport[l] + sectionNameLineEdit.text() + "\n\n"
    }
      while (rawStrings[i]!= undefined &&skipExport===false){


        dataToExport[l] = dataToExport[l] + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n`
      
        dataToExport[l] = dataToExport[l] + ";"

        dataToExport[l] = dataToExport[l] + addressOfEachString[i].toString("hex") + `\n\n`

        i=i+1
      }

      if(skipExport===false){
        l=l+1
        dataToExport[l] = ""
      }
    skipExport=false
    plus1(pointersTableMode,options)
  }
  
  return dataToExport
}

function exportStringsAndMoreFromAllSections(dataToExport,options,addFileName){
  dataToExport = []
  dataToExport[0] = Buffer.from("efbbbf0d0a", "hex")

  let i = 0
  let l =0
  
  exportAllMode =true

  goToStart()
  saveAndPrepare()

  while(stopExport ===false){
    i= 0

    if(addFileName===true&&skipExport===false){
      dataToExport[l] = dataToExport[l] + sectionNameLineEdit.text() + "\n\n"
    }
    while (rawStrings[i]!= undefined&&skipExport===false){

      dataToExport[l] = dataToExport[l] + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n` + ";"
      dataToExport[l] = dataToExport[l] + addressOfEachString[i].toString("hex") + `\n\n` + ";;"
      dataToExport[l] = dataToExport[l] + addressOfEachStringInMemory[i].toString("hex").toUpperCase().replaceAll("00","") + `\n\n` + ";;;"
      dataToExport[l] = dataToExport[l] + addressOfEachPointer[i] + `\n\n`+ ";;;;"
      dataToExport[l] = dataToExport[l] + pointersHexValues[i].toString("hex").toUpperCase() + `\n\n`

      if(rawStrings[i+1]=== undefined){
        let k = 0;
        while(extractedPointersIn4[k] != undefined){


          dataToExport[l] = dataToExport[l] + ";;;;;"
    
          dataToExport[l] = dataToExport[l] + extractedPointersIn4[k].toString("hex").toUpperCase() + `\n\n`
          k= k+1;
        }
      }
      i= i+1;
    }
    if(skipExport===false){
      l=l+1
      dataToExport[l] = ""
    }
    plus1(pointersTableMode,options)
  }
  return dataToExport
}

function checkForSemicolons(listWidgetString,style){
  let i =0
  if(listWidgetString.includes(";")===true){

    if(style===0){
      listWidgetString = listWidgetString.split("\n")
    }else if(style===1){
      listWidgetString = listWidgetString.split(";\r\n")
    }else{
      listWidgetString = listWidgetString.split("\r\n")
    }

    while(listWidgetString[i]!=undefined){

      if(listWidgetString[i].includes(";") &&
      listWidgetString[i][0]!=`"` &&
      listWidgetString[i][listWidgetString[i]-1]!=`"`){
        
        listWidgetString[i] = `"${listWidgetString[i]}"`

      }
      i=i+1
    }
  }

  if(listWidgetString.includes("-")===true||listWidgetString.includes("+")===true){

    i =0

    if(style===0){
      listWidgetString = listWidgetString.split("\n")
    }else if(style===1){
      listWidgetString = listWidgetString.split(";\r\n")
    }else{
      listWidgetString = listWidgetString.split("\r\n")
    }

    while(listWidgetString[i]!=undefined){

      if(listWidgetString[i][0]==="-"||listWidgetString[i][0]==="+"){
        
        listWidgetString[i] = ` ${listWidgetString[i]}`

      }
      i=i+1
    }
  }

  if(Array.isArray(listWidgetString)===true){
    if(style===0){
      listWidgetString = listWidgetString.join("\n")
    }else if(style===1){
      listWidgetString = listWidgetString.join(";\r\n")
    }else{
      listWidgetString = listWidgetString.join("\r\n")
    }
  }

  return listWidgetString
}

function checkForBlankSpaces(listWidgetString){

  if(listWidgetString.includes("\n\n\n\n\n")===true){

    listWidgetString = listWidgetString.replaceAll("\n\n\n\n\n","\n \n \n \n \n")
  }

  if(listWidgetString.includes("\n\n\n\n")===true){

    listWidgetString = listWidgetString.replaceAll("\n\n\n\n","\n \n \n \n")
  }

  if(listWidgetString.includes("\n\n\n")===true){

    listWidgetString = listWidgetString.replaceAll("\n\n\n","\n \n \n")
  }
  
  if(listWidgetString.includes("\n\n")===true){

    listWidgetString = listWidgetString.replaceAll("\n\n","\n \n")
  }

  if(listWidgetString[0]==="\n"){
    listWidgetString  = ` ` +listWidgetString
  }

  
  if(listWidgetString[listWidgetString.length-1]==="\n"){
    listWidgetString  = listWidgetString + ` `
  }

  return listWidgetString
}

//Makes a csv that contains the strings and pointers from currentContent.
async function exportAll(options,addFileName){
let i = 0

let dataToExport = Buffer.from("efbbbf0d0a", "hex")
let dataToExportFinal = []
  if(pointersTableMode===false){

    if(pointer1AddressDecimal === ""){

      //All in this section
      if(options===0){

        dataToExport = exportStringsAndAddressOfSection(dataToExport,addFileName)

      //Strings in this section
      }else if(options===1){

        dataToExport = exportOnlyStringsOfSection(dataToExport,addFileName)
  
      //Strings from all sections
      }else if(options===2){

        dataToExport = exportStringsFromAllSections(dataToExport,options,addFileName)
      
        //Strings and address from all sections
      }else if(options===3){

        dataToExport = exportStringsAndAddressFromAllSections(dataToExport,options,addFileName)
      }

    }else if (pointer1AddressDecimal != ""){
  
      if(options===0){
        if(addFileName===true){
          dataToExport = dataToExport + sectionNameLineEdit.text() + "\n\n"
        }
        while (rawStrings[i]!= undefined){
  
          dataToExport = dataToExport + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n` + ";"
          dataToExport = dataToExport + addressOfEachString[i].toString("hex") + `\n\n` + ";;"
          dataToExport = dataToExport + addressOfEachStringInMemory[i].toString("hex").toUpperCase().replaceAll("00","") + `\n\n` + ";;;"
          dataToExport = dataToExport + addressOfEachPointer[i] + `\n\n`+ ";;;;"
          dataToExport = dataToExport + pointersHexValues[i].toString("hex").toUpperCase() + `\n\n`
    
          if(rawStrings[i+1]=== undefined){
            let k = 0;
            while(extractedPointersIn4[k] != undefined){
    
              dataToExport = dataToExport + ";;;;;"
        
              dataToExport = dataToExport + extractedPointersIn4[k].toString("hex").toUpperCase() + `\n\n`
              k= k+1;
            }
          }
          i= i+1;
        }
      }else if(options===1){

        dataToExport = exportOnlyStringsOfSection(dataToExport,addFileName)

      }else if(options===2){
        dataToExport = exportStringsFromAllSections(dataToExport,options,addFileName)
  
      }else if(options===3){
        exportAllModeVariable =2
        dataToExport = exportStringsAndMoreFromAllSections(dataToExport,options,addFileName)
      }
    }
    //Pointers Table Mode ON
  }else if(pointersTableMode===true){
    exportAllMode =true
    dataToExport = []
    dataToExport[0] = Buffer.from("efbbbf0d0a", "hex")
    let l =0
    goToStart()

    if(options===0){

      while(l!=sectionedCurrentContent.length){
          i= 0
          if(addFileName===true){
            if(dataToExport[l]===undefined){
              dataToExport[l]= ""
            }
            dataToExport[l] = dataToExport[l] + sectionNameLineEdit.text() + ` ${sectionNameNumber.text()}`+ "\n\n"
          }
        while (rawStrings[i]!= undefined ){
    
    
          dataToExport[l] = dataToExport[l] + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n` + ";"
          dataToExport[l] = dataToExport[l] + addressOfEachString[i].toString("hex") + `\n\n` + ";;"
          dataToExport[l] = dataToExport[l] + addressOfEachStringInMemory[i].toString("hex").toUpperCase().replaceAll("00","") + `\n\n` + ";;;"
          dataToExport[l] = dataToExport[l] + addressOfEachPointer[i] + `\n\n`+ ";;;;"
          dataToExport[l] = dataToExport[l] + pointersHexValues[i].toString("hex").toUpperCase() + `\n\n`
    
          if(rawStrings[i+1]=== undefined){
            let k = 0;
            while(extractedPointersIn4[k] != undefined){
    
              dataToExport[l] = dataToExport[l] + ";;;;;"
        
              dataToExport[l] = dataToExport[l] + extractedPointersIn4[k].toString("hex").toUpperCase() + `\n\n`
              k= k+1;
            }
          } 
          i=i+1
        }
        if(skipExport===false){
          l=l+1
          dataToExport[l] = ""
        }
        plus1(pointersTableMode)
      }

    }else if(options===1){

      while(l!=sectionedCurrentContent.length){
          i= 0
          if(addFileName===true){
            if(dataToExport[l]===undefined){
              dataToExport[l]= ""
            }
            dataToExport[l] = dataToExport[l] + sectionNameLineEdit.text() + ` ${sectionNameNumber.text()}`+ "\n\n"
          }
        while (rawStrings[i]!= undefined ){
    
    
          dataToExport[l] = dataToExport[l] + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n`
            
          i=i+1
        }
        l=l+1
        plus1(pointersTableMode)
      }

    }else if(options===2){


      let list = []
      let ptFilesList = []

      list = await new Promise((resolve, reject) => {
        return fs.readdir('./Pointers Tables/', (err, filenames) => err != null ? reject(err) : resolve(filenames))
      })

      if(list[0]===undefined){
        errorMessageBox.setWindowTitle("Error")
        errorMessageBox.setText("ERROR! The folder doesn't exist or there are not files.")
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
        return
      } else{
        let i =0
        list.forEach(file => {
          if(file.substring(file.length-3,file.length) ===".pt"&&fs.lstatSync(`./Pointers Tables/${file}`).isDirectory()===false){
            ptFilesList[i] = file
            i= i+1
          }
        })
      }

      let m = 0
      while(ptFilesList[m]!= undefined){
        selectedPTFile = `./Pointers Tables/${ptFilesList[m]}`
        loadPointersTable(selectedPTFile)
        l =0
        dataToExport = []

        if(m===0){
          dataToExport[0] = Buffer.from("efbbbf0d0a", "hex")
        }

        while(l!=sectionedCurrentContent.length){
            i= 0
            if(dataToExport[l]===undefined){
              dataToExport[l]= ""
            }
            if(addFileName===true){
              dataToExport[l] = dataToExport[l] + sectionNameLineEdit.text() + ` ${sectionNameNumber.text()}`+ "\n\n"
            }

          while (rawStrings[i]!= undefined ){

            dataToExport[l] = dataToExport[l] + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n`
              
            i=i+1
          }
          if(skipExport===false){
            l=l+1
            dataToExport[l] = ""
          }
          plus1(pointersTableMode)
        }
        dataToExportFinal[m] = dataToExport.join("")
        m=m+1
      }

    }else if(options===3){

      let list = []
      let ptFilesList = []

      list = await new Promise((resolve, reject) => {
        return fs.readdir('./Pointers Tables/', (err, filenames) => err != null ? reject(err) : resolve(filenames))
      })

      if(list[0]===undefined){
        errorMessageBox.setWindowTitle("Error")
        errorMessageBox.setText("ERROR! The folder doesn't exist or there are not files.")
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
        return
      } else{
        let i =0
        list.forEach(file => {
          if(file.substring(file.length-3,file.length) ===".pt"&&fs.lstatSync(`./Pointers Tables/${file}`).isDirectory()===false){
            ptFilesList[i] = file
            i= i+1
          }
        })
      }

      let m = 0
      while(ptFilesList[m]!= undefined){
        selectedPTFile = `./Pointers Tables/${ptFilesList[m]}`
        loadPointersTable(selectedPTFile)
        l =0
        dataToExport = []

        if(m===0){
          dataToExport[0] = Buffer.from("efbbbf0d0a", "hex")
        }
        
        while(l!=sectionedCurrentContent.length){

          if(dataToExport[l]===undefined){
            dataToExport[l]= ""
          }
          if(addFileName===true){
            dataToExport[l] = dataToExport[l] + sectionNameLineEdit.text() + ` ${sectionNameNumber.text()}`+ "\n\n"
          }
            i= 0
          while (rawStrings[i]!= undefined ){
      
            dataToExport[l] = dataToExport[l] + checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()),0) + `\n\n` + ";"
            dataToExport[l] = dataToExport[l] + addressOfEachString[i].toString("hex") + `\n\n` + ";;"
            dataToExport[l] = dataToExport[l] + addressOfEachStringInMemory[i].toString("hex").toUpperCase().replaceAll("00","") + `\n\n` + ";;;"
            dataToExport[l] = dataToExport[l] + addressOfEachPointer[i] + `\n\n`+ ";;;;"
            dataToExport[l] = dataToExport[l] + pointersHexValues[i].toString("hex").toUpperCase() + `\n\n`
          
            i=i+1
          }
          if(skipExport===false){
            l=l+1
            dataToExport[l] = ""
          }
          plus1(pointersTableMode)
        }
        dataToExportFinal[m] = dataToExport.join("")
        m=m+1
      }
    }
  }
  
  exportAllModeVariable =0
  skipExport=false
  stopExport=false
  exportAllMode= false

  if(dataToExportFinal[0]===undefined){

    if(Array.isArray(dataToExport)===true){
      dataToExport = dataToExport.join("")
    }

    fs.writeFile(`./exportedData.csv`,`${dataToExport}`,{
      encoding: "utf8",
      flag: "w",
      mode: 0o666
    },(err) => {
  
      if (err){
        errorMessageBox.setWindowTitle("Error")
        errorMessageBox.setText("ERROR! maybe the file is being used?")
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
      }
      else{
        errorMessageBox.setWindowTitle("Task completed")
        errorMessageBox.setText(`The data has been exported to the root folder\nsucessfully.`)
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
      }
    })
  }else{

    dataToExportFinal = dataToExportFinal.join("")

      fs.writeFile(`./exportedData.csv`,`${dataToExportFinal}`,{
        encoding: "utf8",
        flag: "w",
        mode: 0o666
      },(err) => {
    
        if (err){
          errorMessageBox.setWindowTitle("Error")
          errorMessageBox.setText("ERROR! maybe the file is being used?")
          errorMessageButton.setText("                                                Ok                                              ")
          errorMessageBox.exec()
        }
        else{
          errorMessageBox.setWindowTitle("Task completed")
          errorMessageBox.setText(`The data has been exported to the root folder\nsucessfully.`)
          errorMessageButton.setText("                                                Ok                                              ")
          errorMessageBox.exec()
        }
      })
  }

}

//Depending of if Hide 0's from viewer is checked this function hide the 0's or not.
function hideShow(){
  let i =0;
  hiddenPointers = 0;
  while(extractedPointersIn4[i]!= undefined){
    
    if(pointersViewerlistWidget.item(i).text()==="00000000"&& pointersViewerButtonToHide00.isChecked()===true){
      pointersViewerlistWidget.item(i).setHidden(true)
      hiddenPointers = hiddenPointers+1;
    }

    if(pointersViewerlistWidget.item(i).text()==="00000000"&& pointersViewerButtonToHide00.isChecked()===false){
      pointersViewerlistWidget.item(i).setHidden(false)
    }
    i=i+1;
  }

  pointersViewerTitleLabel.setText(`Pointers Viewer (${extractedPointersIn4.length-hiddenPointers}) (${sharedPointers})`)
}

//When a string is clicked in the main list widget this function search it hex values in the
//pointers viewer, if found a match, is selected.
function highlightPointers(){
  
  if(pointer1AddressDecimal!= ""){
    let i =0;
    sharedPointers=1

    pointersViewerForSharedPointersListWidget.clear()
    pointersEditor.clear()
    pointersEditorLabel.setText("#n")

    while(extractedPointersIn4[i] != undefined){

      if(extractedPointersIn4[i].toString("hex").toUpperCase() === pointersHexValues[listWidget.currentRow()].toString("hex").toUpperCase()){
          
        pointersViewerlistWidget.setCurrentRow(i)
        break
      }

      else if(i+2>extractedPointersIn4.length){
        errorMessageBox.setWindowTitle("Error")
        errorMessageBox.setText(`Oh no, the string #${listWidget.currentRow()+1} has 0 pointers associated with it\n are you sure that both pointer addresses are correct?\nIf that is the case may the pointers of this string are\nin another place or the pointers are in Big Endian.`)
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
      }
      i=i+1;
    }
  }
}

//If there are enough 00's at the end of the string section that is being edited
//this function makes the second 00 after the last string 20 (space)
//then relocate that pointer to make it match with this "new string" and
//finally add this new string to the main string list widget.
function relocateToNewString(){

  if(pointersEditor.text().match(/^(?:[0-9A-F]{8})$/i) ===null){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("The new pointer values are not valid")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return

  }else if(numSpaceLeft<3){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Not enough space :/")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return

  }
  let i =0;
  let newStringAddressDecimal =""
  while(currentContent[parseInt(addressOfEachString[addressOfEachString.length-1],16)+i] !="00"){

    if(currentContent[parseInt(addressOfEachString[addressOfEachString.length-1],16)+i+1] ===0 && currentContent[parseInt(addressOfEachString[addressOfEachString.length-1],16)+i+2] ===0){

      newStringAddressDecimal = (parseInt(addressOfEachString[addressOfEachString.length-1],16)+i+2).toString(16).toUpperCase()
      break

    }
    i=i+1;
  }

  currentContent[parseInt(newStringAddressDecimal,16)] = 32


  let firstPointerW = pointersViewerlistWidget.item(0).text()

  let firstPointerValuesInDecimals =""
  if(bigEndian.isChecked()===true){
    firstPointerValuesInDecimals = Buffer.from(firstPointerW, "hex").readUIntBE(0,Buffer.from(firstPointerW, "hex").length)
  }else{
    firstPointerValuesInDecimals = Buffer.from(firstPointerW, "hex").readUIntLE(0,Buffer.from(firstPointerW, "hex").length)
  }


  i = 1;
  let k = 0;

  while(pointersHexValues[k] != undefined){
    oldPointersHexValues[k] =  pointersHexValues[k]
    k=k+1;
  }

  let differenceInDecimals = parseInt(newStringAddressDecimal,16)-parseInt(addressOfEachString[0],16)
  let nextPointerInDecimals = firstPointerValuesInDecimals+differenceInDecimals;
  let newPointerHexValues

  if(bigEndian.isChecked()===true){

    newPointerHexValues = nextPointerInDecimals.toString(16)

  }else{

    newPointerHexValues = nextPointerInDecimals.toString(16).padStart(firstPointerW.length, '0').match(/.{1,2}/g).reverse().join('') 
    
  }

  k=0
  //Add 00 to the right or left side of pointer.
  if(newPointerHexValues.length<extractedPointersIn4[0].toString("hex").length
  &&extractedPointersIn4[i]!= undefined){

    while(k<Math.trunc(newStringAddressDecimal.toString(16).length/2)){
      let left = false
      let right = false
  
      if(extractedPointersIn4[0].toString("hex")[k] ==="0"){
        left = true
      }
        
      if(extractedPointersIn4[0].toString("hex")[extractedPointersIn4[0].toString("hex").length-k-1] ==="0"){
        right = true
      }
  
      if(left === true && right === false){
          
        while(newPointerHexValues.length<extractedPointersIn4[0].toString("hex").length){
          newPointerHexValues =  "0" + newPointerHexValues
        }
  
      }else if(left === false && right === true){
          
        while(newPointerHexValues.length<extractedPointersIn4[0].toString("hex").length){
          newPointerHexValues = newPointerHexValues+ "0"
        }
      }
      k=k+1
    }
  }
  i=i+1

  pointersEditor.setText(newPointerHexValues.toUpperCase())
  saveEditedPointer()
}

//When a item in the pointers viewer is edited, needs to change it highlight to make it
//match with it new values (same goes for shared pointers viewer), this
//function does that and also saves the pointer changed in currentContent to the file.
function saveEditedPointer(){

  if(pointersEditor.text().match(/^(?:[0-9A-F]{8})$/i) ===null){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("The new pointer values are not valid")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }
  extractedPointersIn4[oldMatchedSharedPointers[pointersViewerForSharedPointersListWidget.currentRow()]] =  Buffer.from(pointersEditor.text(),"hex")
  pointersViewerForSharedPointersListWidget.currentItem().setText(pointersEditor.text())
  pointersViewerlistWidget.item(oldMatchedSharedPointers[pointersViewerForSharedPointersListWidget.currentRow()]).setText(pointersEditor.text())
  pointersViewerForSharedPointersListWidget.currentItem().setText(pointersEditor.text())

  extractedPointers = Buffer.concat(extractedPointersIn4)

  let tempCurrentContent = currentContent.toString("binary")
  let tempExtractedPointers = extractedPointers.toString("binary")

  tempCurrentContent = tempCurrentContent.substring(0,pointer1AddressDecimal) + tempExtractedPointers  + tempCurrentContent.substring(pointer2AddressDecimal)
  currentContent = Buffer.from(tempCurrentContent, "binary")
  pointersViewerlistWidget.removeItemWidget(pointersViewerlistWidget.item(oldMatchedSharedPointers[pointersViewerForSharedPointersListWidget.currentRow()]))

  if(pointersViewerForSharedPointersListWidget.currentRow()===0){
    let pointerViewerListQWidget = new QWidget()
    let pointerViewerListQWidgetLayout = new FlexLayout
    pointerViewerListQWidget.setLayout(pointerViewerListQWidgetLayout)
    let pointerViewerListQWidgetText = new QLabel
    pointerViewerListQWidgetText.setText(pointersEditor.text())
    pointerViewerListQWidgetText.setInlineStyle(`
    color:red;
    margin: 0 1 0 0;
    `)
    pointerViewerListQWidgetLayout.addWidget(pointerViewerListQWidgetText)
    pointersViewerlistWidget.setItemWidget(pointersViewerlistWidget.item(oldMatchedSharedPointers[pointersViewerForSharedPointersListWidget.currentRow()]),pointerViewerListQWidget)
  }else{
    let pointerViewerListQWidget2 = new QWidget()
    let pointerViewerListQWidgetLayout2 = new FlexLayout
    pointerViewerListQWidget2.setLayout(pointerViewerListQWidgetLayout2)
    let pointerViewerListQWidgetText2 = new QLabel
    pointerViewerListQWidgetText2.setText(pointersEditor.text())
    pointerViewerListQWidgetText2.setInlineStyle(`
    color:midnightblue;
    margin: 0 1 0 0;
    `)
    pointerViewerListQWidgetLayout2.addWidget(pointerViewerListQWidgetText2)
    pointersViewerlistWidget.setItemWidget(pointersViewerlistWidget.item(oldMatchedSharedPointers[pointersViewerForSharedPointersListWidget.currentRow()]),pointerViewerListQWidget2)
    sharedPointers=sharedPointers+1;
  }

  fs.writeFile(`${selectedFile}`,currentContent,{
    encoding: "binary",
    flag: "w",
    mode: 0o666
  },
  (err) => {
    if (err){
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText("ERROR! maybe the file is being used?")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
    }
    else {
      console.log("File written successfully\n");
    }
  })
}

function getPointersTableData(){

  if(filePathQLineEditRead.text()==="N/A"){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Not file selected, please select one first.")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }else if(fs.existsSync(`${filePathQLineEditRead.text()}`)===false){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("The choosed file is not there.\nInvalid file path, aborting...")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }

  const createPointersDialog = new QDialog()
  createPointersDialog.setModal(true)
  win.addEventListener("Close", function (){
    createPointersDialog.close(true)
  })

  createPointersDialog.setFixedSize(260,300)
  createPointersDialog.setWindowTitle('Table Data')

  const createPointersDialogLayout = new QBoxLayout(2)
  createPointersDialog.setLayout(createPointersDialogLayout)

    //Table Name--------------------------------------------------------

  const pointersTableSectionNameTitle = new QWidget();

  const pointersTableSectionNameTitleLayout = new FlexLayout();
  pointersTableSectionNameTitle.setLayout(pointersTableSectionNameTitleLayout)

  createPointersDialogLayout.addWidget(pointersTableSectionNameTitle)

  const pointersTableSectionNameLabel = new QLabel()
  pointersTableSectionNameLabel.setText("Table name *")
  pointersTableSectionNameLabel.setAlignment(132)
  pointersTableSectionNameLabel.setInlineStyle(`
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  const pointersTableSectionNameLineEdit = new QLineEdit();
  pointersTableSectionNameLineEdit.setPlaceholderText("Table name")
  pointersTableSectionNameLineEdit.setToolTip("Add a name for the Pointers Table.")
  pointersTableSectionNameLineEdit.setInlineStyle(`
  width:238px;
  `)

  pointersTableSectionNameTitleLayout.addWidget(pointersTableSectionNameLabel)
  pointersTableSectionNameTitleLayout.addWidget(pointersTableSectionNameLineEdit)
  let ptFileName =  filePathQLineEditRead.text().replace(/^.*[\\\/]/, "").split('.')[0]

  pointersTableSectionNameLineEdit.setText(ptFileName)
  
  //Pointers Table Addresses--------------------------------------------------------

  const firstPointerTableAddressLineEdit = new QLineEdit();
  const lastPointerTableAddressLineEdit = new QLineEdit();
  firstPointerTableAddressLineEdit.setToolTip("1° Pointers Table Index pointer address in the file (without 0x). Usually is 0.")
  firstPointerTableAddressLineEdit.setPlaceholderText("First pointer address")
  lastPointerTableAddressLineEdit.setPlaceholderText("Post-last pointer address")
  lastPointerTableAddressLineEdit.setToolTip("Post-last Pointers Table Index pointer address in the file (without 0x).\nUsually is the starting address of FFFFFFFFFFFFFFFF")
  lastPointerTableAddressLineEdit.setInlineStyle(`
  width:118px;
  font-size:11px;
  `)
  firstPointerTableAddressLineEdit.setInlineStyle(`
  width:119px;
  font-size:11px;
  `)
  const pointerTableAddressWidget = new QWidget()
  const pointerTableAddressTitleWidget = new QWidget()
  const pointerTableAddressLineEditWidget = new QWidget()

  createPointersDialogLayout.addWidget(pointerTableAddressWidget)

  const pointerTableAddressWidgetLayout = new FlexLayout()
  const pointerTableAddressTitleWidgetLayout = new FlexLayout()
  const pointerTableAddressLineEditWidgetLayout = new FlexLayout()

  pointerTableAddressTitleWidget.setInlineStyle(`
  flex-direction:row;

  `)
  pointerTableAddressLineEditWidget.setInlineStyle(`
  flex-direction:row;
  `)

  pointerTableAddressWidget.setLayout(pointerTableAddressWidgetLayout)
  pointerTableAddressTitleWidget.setLayout(pointerTableAddressTitleWidgetLayout)
  pointerTableAddressLineEditWidget.setLayout(pointerTableAddressLineEditWidgetLayout)

  const pointerTableAddressLineEditTitle = new QLabel();
  pointerTableAddressLineEditTitle.setText("Pointers Table Index *")
  pointerTableAddressLineEditTitle.setAlignment(132)
  pointerTableAddressLineEditTitle.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  pointerTableAddressLineEditWidgetLayout.addWidget(firstPointerTableAddressLineEdit)
  pointerTableAddressLineEditWidgetLayout.addWidget(lastPointerTableAddressLineEdit)

  pointerTableAddressWidgetLayout.addWidget(pointerTableAddressLineEditTitle)
  pointerTableAddressWidgetLayout.addWidget(pointerTableAddressLineEditWidget)

  //Global offset--------------------------------------------------------


  const gloalOffsetTitle = new QWidget();
  const globalOffsetTitleLayout = new FlexLayout();
  gloalOffsetTitle.setLayout(globalOffsetTitleLayout)


  const globalOffsetLineEditAndButton = new QWidget() 
  const globalOffsetLineEditAndButtonLayout = new FlexLayout();

  globalOffsetLineEditAndButton.setLayout(globalOffsetLineEditAndButtonLayout)
  
  createPointersDialogLayout.addWidget(gloalOffsetTitle)
  

  const globalOffsetTitleLabel = new QLabel()
  globalOffsetTitleLabel.setText("Global Offset")
  globalOffsetTitleLabel.setAlignment(132)
  globalOffsetTitleLabel.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  globalOffsetTitleLayout.addWidget(globalOffsetTitleLabel)
  globalOffsetTitleLayout.addWidget(globalOffsetLineEditAndButton)

  const globalOffsetLineEdit = new QLineEdit();
  globalOffsetLineEdit.setText("0")
  globalOffsetLineEdit.setPlaceholderText("0")
  globalOffsetLineEdit.setToolTip("Add a offset to the start of all Pointers Tables.\nUseful when a Index Pointer points out something that is not a pointer.")
  globalOffsetLineEdit.setEnabled(false)
  globalOffsetLineEdit.setInlineStyle(`
  width:238px;
  font-size:11px;
  `)

  const globalOfssetButton = new QCheckBox()
  globalOffsetLineEditAndButtonLayout.addWidget(globalOfssetButton)
  globalOffsetLineEditAndButtonLayout.addWidget(globalOffsetLineEdit)
  globalOffsetLineEditAndButton.setInlineStyle(`
  flex-direction:row;
  `)
  globalOfssetButton.addEventListener("clicked",function (){
    
    if(globalOfssetButton.isChecked()===true){
      globalOffsetLineEdit.setEnabled(true)
    }else{
      globalOffsetLineEdit.setEnabled(false)
    }
  })


  //First Pointer of the first Table Address--------------------------------------------------------

  const firstPointerTitle = new QWidget();

  const firstPointerTitleLayout = new FlexLayout();
  firstPointerTitle.setLayout(firstPointerTitleLayout)
  // createPointersDialogLayout.addWidget(firstPointerTitle)

  const firstPointerTitleLabel = new QLabel()
  firstPointerTitleLabel.setText("1° Pointer address of the 1° Pointers Table *")
  firstPointerTitleLabel.setAlignment(132)
  firstPointerTitleLabel.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  firstPointerTitleLayout.addWidget(firstPointerTitleLabel)

  const firstPointerAddressLineEdit2 = new QLineEdit();
  firstPointerAddressLineEdit2.setPlaceholderText("1° Pointer of the 1° Pointers Table")
  firstPointerAddressLineEdit2.setToolTip("First pointer address for the first Pointers Table (without 0x).\nIt will be found using the Pointers Table Index.")
  firstPointerAddressLineEdit2.setEnabled(false)
  firstPointerAddressLineEdit2.setInlineStyle(`
  width:238px;
  font-size:11px;
  `)

  firstPointerTitleLayout.addWidget(firstPointerAddressLineEdit2)
  firstPointerTableAddressLineEdit.setText("0")

  //First String of the first Table Address--------------------------------------------------------

  const firstStringTitle = new QWidget();

  const firstStringTitleLayout = new FlexLayout();
  firstStringTitle.setLayout(firstStringTitleLayout)
  // createPointersDialogLayout.addWidget(firstStringTitle)

  const firstStringTitleLabel = new QLabel()
  firstStringTitleLabel.setText("1° String Address *")
  firstStringTitleLabel.setAlignment(132)
  firstStringTitleLabel.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  firstStringTitleLayout.addWidget(firstStringTitleLabel)

  const firstStringAddressLineEdit2 = new QLineEdit();
  firstStringAddressLineEdit2.setPlaceholderText("1° String Address")
  firstStringAddressLineEdit2.setToolTip("First string address in the file (without 0x).\nIt will be found using the Pointers Table Index.")
  firstStringAddressLineEdit2.setEnabled(false)
  firstStringAddressLineEdit2.setInlineStyle(`
  width:238px;
  font-size:11px;
  `)

  firstStringTitleLayout.addWidget(firstStringAddressLineEdit2)
  //Post-last string of the last Pointers Table--------------------------------------------------------

  const postLastStringTitle = new QWidget();

  const postLastStringTitleLayout = new FlexLayout();
  postLastStringTitle.setLayout(postLastStringTitleLayout)
  createPointersDialogLayout.addWidget(postLastStringTitle)

  const postLastStringTitleLabel = new QLabel()
  postLastStringTitleLabel.setText("Post-last String Address *")
  postLastStringTitleLabel.setAlignment(132)
  postLastStringTitleLabel.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  postLastStringTitleLayout.addWidget(postLastStringTitleLabel)

  const postLastStringAddressLineEdit = new QLineEdit();
  postLastStringAddressLineEdit.setPlaceholderText("Post-last String Address")
  postLastStringAddressLineEdit.setToolTip("Post-last String Address in the file (without 0x).\nIf there are nothing else after the last string\nuse the address of the last character.")
  postLastStringAddressLineEdit.setEnabled(true)
  postLastStringAddressLineEdit.setInlineStyle(`
  width:238px;
  font-size:11px;
  `)

  postLastStringTitleLayout.addWidget(postLastStringAddressLineEdit)

  //Next Step Button--------------------------------------------------------

  const createPointersTableButton = new QPushButton()

  createPointersTableButton.setText("Next step")
  createPointersTableButton.addEventListener("clicked",function (){

    
    if(firstPointerTableAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && lastPointerTableAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && pointersTableSectionNameLineEdit.text().match(/^[a-zA-Z0-9 ]+$/) !=null
    && globalOffsetLineEdit.text().match(/^[0-9]+$/)
    && postLastStringAddressLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && fs.existsSync(`${selectedFile}`) === true
    ){
      
    console.log("The hex format is correct!")
    }
    else{
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Not correct hex format, invalid file path, name or offset, aborting...")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return

    }
    
    createPointersDialog.close(true)


    const createPointersDialogStep2 = new QDialog()
    createPointersDialogStep2.setModal(true)
    win.addEventListener("Close", function (){

      createPointersDialogStep2.close(true)
    })

    createPointersDialogStep2.setWindowTitle('Index Pointers Selector')
    createPointersDialogStep2.setFixedSize(260,400)
    
    const createPointersDialogStep2Label = new QLabel()
    createPointersDialogStep2Label.setText("Select the pointers of the Index\nTable")
    
    const createPointersDialogStep2Layout = new QBoxLayout(2)
    createPointersDialogStep2.setLayout(createPointersDialogStep2Layout)

    createPointersDialogStep2.show()

    let k = 0
    let i = 0
    currentContent = fs.readFileSync(`${filePathQLineEditRead.text()}`)
    extractedTablePointersRaw = currentContent.slice(parseInt(firstPointerTableAddressLineEdit.text(),16),parseInt(lastPointerTableAddressLineEdit.text(),16))

    const pointersTableViewerlistWidget = new QListWidget()
    const pointersTableViewerOptionsWidget = new QWidget()
    const pointersTableViewerQButtonGroup = new QButtonGroup()
    const pointersTableViewerOptionsCheckBoxesWidget = new QWidget()


    const pointersTableViewerOption1CheckBox = new QRadioButton()
    pointersTableViewerOption1CheckBox.setText("All")

    const pointersTableViewerOption2CheckBox = new QRadioButton()
    pointersTableViewerOption2CheckBox.setText("Odd")

    const pointersTableViewerOption3CheckBox = new QRadioButton()
    pointersTableViewerOption3CheckBox.setText("Even")

    const pointersTableViewerOption4CheckBox = new QRadioButton()
    pointersTableViewerOption4CheckBox.setText("None")

    pointersTableViewerQButtonGroup.addEventListener("idClicked",function(){
      if(pointersTableViewerQButtonGroup.checkedId() ===0){

        for(i=0; i<=pointersTableViewerlistWidget.count()-1;i++){
          if(pointersTableViewerlistWidget.item(i).text()!="FFFFFFFF"){
            pointersTableViewerlistWidget.item(i).setCheckState(2)
          }
        }

      }else if(pointersTableViewerQButtonGroup.checkedId() ===1){

        for(i=0; i<=pointersTableViewerlistWidget.count()-1;i+=2){
          if(pointersTableViewerlistWidget.item(i).text()!="FFFFFFFF"){
            pointersTableViewerlistWidget.item(i).setCheckState(2)
          }
        }

        for(i=1; i<=pointersTableViewerlistWidget.count()-1;i+=2){
          if(pointersTableViewerlistWidget.item(i).text()!="FFFFFFFF"){
            pointersTableViewerlistWidget.item(i).setCheckState(0)
          }
        }

      }else if(pointersTableViewerQButtonGroup.checkedId() ===2){

        for(i=1; i<=pointersTableViewerlistWidget.count()-1;i+=2){
          if(pointersTableViewerlistWidget.item(i).text()!="FFFFFFFF"){
            pointersTableViewerlistWidget.item(i).setCheckState(2)
          }
        }

        for(i=0; i<=pointersTableViewerlistWidget.count()-1;i+=2){
          if(pointersTableViewerlistWidget.item(i).text()!="FFFFFFFF"){
            pointersTableViewerlistWidget.item(i).setCheckState(0)
          }
        }
        
      }else{
        for(i=0; i<=pointersTableViewerlistWidget.count()-1;i++){
          if(pointersTableViewerlistWidget.item(i).text()!="FFFFFFFF"){
            pointersTableViewerlistWidget.item(i).setCheckState(0)
          }
        }
      }
    })

    pointersTableViewerQButtonGroup.addButton(pointersTableViewerOption1CheckBox, 0)
    pointersTableViewerQButtonGroup.addButton(pointersTableViewerOption2CheckBox, 1)
    pointersTableViewerQButtonGroup.addButton(pointersTableViewerOption3CheckBox, 2)
    pointersTableViewerQButtonGroup.addButton(pointersTableViewerOption4CheckBox, 3)

    const pointersTableViewerOptionsTitleLabel = new QLabel()
    pointersTableViewerOptionsTitleLabel.setText("Check:")
    const pointersTableViewerOptionsWidgetLayout = new QBoxLayout(2)

    const pointersTableViewerOptionsCheckBoxesWidgetLayout = new QBoxLayout(0)
    pointersTableViewerOptionsCheckBoxesWidget.setLayout(pointersTableViewerOptionsCheckBoxesWidgetLayout)
    pointersTableViewerOptionsCheckBoxesWidgetLayout.addWidget(pointersTableViewerOption1CheckBox)
    pointersTableViewerOptionsCheckBoxesWidgetLayout.addWidget(pointersTableViewerOption2CheckBox)
    pointersTableViewerOptionsCheckBoxesWidgetLayout.addWidget(pointersTableViewerOption3CheckBox)
    pointersTableViewerOptionsCheckBoxesWidgetLayout.addWidget(pointersTableViewerOption4CheckBox)

    const step2Button = new QPushButton()
 
    step2Button.setText("Next")

    pointersTableViewerOptionsWidget.setLayout(pointersTableViewerOptionsWidgetLayout)
    pointersTableViewerOptionsWidgetLayout.addWidget(pointersTableViewerOptionsTitleLabel)
    pointersTableViewerOptionsWidgetLayout.addWidget(pointersTableViewerOptionsCheckBoxesWidget)
    pointersTableViewerOptionsWidgetLayout.addWidget(step2Button)
    pointersTableViewerOptionsWidgetLayout.addWidget(createPointersDialogStep2Label)

    createPointersDialogStep2Layout.addWidget(pointersTableViewerlistWidget)
    createPointersDialogStep2Layout.addWidget(pointersTableViewerOptionsWidget)


    while(Number(extractedTablePointersRaw.length)>1){

      extractedTablePointersIn4[i] = extractedTablePointersRaw.slice(0,4)

      if(extractedTablePointersRaw.slice(0,4).toString("hex") != "00000000"){
        extractedTablePointersIn4Non0[k] = extractedTablePointersRaw.slice(0,4)
        k=k+1
      }
      extractedTablePointersRaw = extractedTablePointersRaw.slice(4)

      
      const extractedItem = new QListWidgetItem()

      extractedItem.setText( `${extractedTablePointersIn4[i].toString("hex").toUpperCase()}`)

      extractedItem.setCheckState(0)
      pointersTableViewerlistWidget.addItem(extractedItem)

      if(extractedItem.text()==="00000000"&&pointersViewerButtonToHide00.isChecked()===true){
        extractedItem.setHidden(true)
      }

      i = i+1;
    }

    step2Button.addEventListener("clicked",function (){

      k = 0

      for(i=0; i!=pointersTableViewerlistWidget.count();i++){

        if(pointersTableViewerlistWidget.item(i).checkState()===2){
          selectedTablePointers[k] = pointersTableViewerlistWidget.item(i).text()
          k = k+1

        }
      }

      if(selectedTablePointers.length===0){
        errorMessageBox.setWindowTitle("Error")
        errorMessageBox.setText("ERROR! No Pointers selected, please select at least 1")
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
      return
      }

      createPointersDialogStep2.close(true)
      globalOffset = Number(globalOffsetLineEdit.text())
      if(firstPointersTableAddressLineEdit.text()=== ""){
        win.setFixedSize(728, 544);

        listWidget.setInlineStyle(`
        margin: 2px;
        min-height:440px;
        width:210px;
        flex:1;
      `)
      }

      postLastStringAddress = postLastStringAddressLineEdit.text()

      firstPointersTableAddressLineEdit.setText(firstPointerTableAddressLineEdit.text())
      lastPointersTableAddressLineEdit.setText(lastPointerTableAddressLineEdit.text())
      sectionNameLineEdit.setText(pointersTableSectionNameLineEdit.text())

      createPointersTable(pointersTableSectionNameLineEdit.text())

    })

  })

  createPointersDialogLayout.addWidget(createPointersTableButton)

  postLastStringAddressLineEdit.setText(((fs.readFileSync(`${selectedFile}`)).length-1).toString(16))
  
  //MH2 Preloaded Pointers Tables Configurations
  if(pointersTableSectionNameLineEdit.text()==="armor"){
    lastPointerTableAddressLineEdit.setText("40")
  }else if(pointersTableSectionNameLineEdit.text()==="bar"){
    lastPointerTableAddressLineEdit.setText("50")
  }else if(pointersTableSectionNameLineEdit.text()==="bar2"){
    lastPointerTableAddressLineEdit.setText("70")
  }else if(pointersTableSectionNameLineEdit.text()==="bar3"){
    lastPointerTableAddressLineEdit.setText("48")
  }else if(pointersTableSectionNameLineEdit.text()==="cocot"){
    lastPointerTableAddressLineEdit.setText("90")
  }else if(pointersTableSectionNameLineEdit.text()==="mh01"){
    lastPointerTableAddressLineEdit.setText("78")
  }else if(pointersTableSectionNameLineEdit.text()==="mh02"){
    lastPointerTableAddressLineEdit.setText("78")
  }else if(pointersTableSectionNameLineEdit.text()==="mh03"){
    lastPointerTableAddressLineEdit.setText("78")
  }else if(pointersTableSectionNameLineEdit.text()==="mhc"){
    lastPointerTableAddressLineEdit.setText("28")
  }else if(pointersTableSectionNameLineEdit.text()==="monmae"){
    lastPointerTableAddressLineEdit.setText("80")
  }else if(pointersTableSectionNameLineEdit.text()==="square"){
    lastPointerTableAddressLineEdit.setText("58")
  }else if(pointersTableSectionNameLineEdit.text()==="tunnel"){
    lastPointerTableAddressLineEdit.setText("08")
  }

  //MHP3rd Preloaded Pointers Tables Configurations
  if(pointersTableSectionNameLineEdit.text()==="0017"&& fs.readFileSync(`${selectedFile}`)[parseInt("72BED",16)]===93){
    lastPointerTableAddressLineEdit.setText("CC")
    postLastStringAddressLineEdit.setText("72BED")
  }else if(pointersTableSectionNameLineEdit.text()==="0017"&& fs.readFileSync(`${selectedFile}`)[parseInt("72F37",16)]===93){
    lastPointerTableAddressLineEdit.setText("CC")
    postLastStringAddressLineEdit.setText("72F37")
  }else if(pointersTableSectionNameLineEdit.text()==="2813"){//nonHD
    lastPointerTableAddressLineEdit.setText("0C")
    postLastStringAddressLineEdit.setText("389A")
  }else if(pointersTableSectionNameLineEdit.text()==="2836"){//HD
    lastPointerTableAddressLineEdit.setText("0C")
    postLastStringAddressLineEdit.setText("37B4")
  }else if(pointersTableSectionNameLineEdit.text()==="2814"||pointersTableSectionNameLineEdit.text()==="2837"){
    lastPointerTableAddressLineEdit.setText("0C")
    postLastStringAddressLineEdit.setText("3014")
  }else if(pointersTableSectionNameLineEdit.text()==="2815"||pointersTableSectionNameLineEdit.text()==="2838"){
    lastPointerTableAddressLineEdit.setText("0C")
    postLastStringAddressLineEdit.setText("25B42")
  }else if(pointersTableSectionNameLineEdit.text()==="2816"){//nonHD
    lastPointerTableAddressLineEdit.setText("24")
    postLastStringAddressLineEdit.setText("23317")
  }else if(pointersTableSectionNameLineEdit.text()==="2839"){//HD
    lastPointerTableAddressLineEdit.setText("24")
    postLastStringAddressLineEdit.setText("232F1")
  }else if(pointersTableSectionNameLineEdit.text()==="2817"||pointersTableSectionNameLineEdit.text()==="2840"){
    lastPointerTableAddressLineEdit.setText("10")
    postLastStringAddressLineEdit.setText("5F6B0")
  }else if(pointersTableSectionNameLineEdit.text()==="2818"||pointersTableSectionNameLineEdit.text()==="2841"){
    lastPointerTableAddressLineEdit.setText("10")
    postLastStringAddressLineEdit.setText("A913")
  }else if(pointersTableSectionNameLineEdit.text()==="2819"||pointersTableSectionNameLineEdit.text()==="2842"){
    lastPointerTableAddressLineEdit.setText("0C")
    postLastStringAddressLineEdit.setText("2645")
  }else if(pointersTableSectionNameLineEdit.text()==="4202"||pointersTableSectionNameLineEdit.text()==="4290"){
    lastPointerTableAddressLineEdit.setText("88")
    postLastStringAddressLineEdit.setText("25F3D")
    globalOffsetLineEdit.setText("4")
  }else if(pointersTableSectionNameLineEdit.text()==="4203"||pointersTableSectionNameLineEdit.text()==="4291"){
    lastPointerTableAddressLineEdit.setText("40")
    postLastStringAddressLineEdit.setText("117B7")
    globalOffsetLineEdit.setText("4")
  }else if(pointersTableSectionNameLineEdit.text()==="4204"||pointersTableSectionNameLineEdit.text()==="4292"){
    lastPointerTableAddressLineEdit.setText("20")
    postLastStringAddressLineEdit.setText("15B92")
    globalOffsetLineEdit.setText("4")
  }

  createPointersDialog.show()

}

async function createPointersTable(name){

tableStartPointerFileAddresses[0] = (parseInt(firstPointerAddressLineEdit.text(),16)).toString(16)
tableEndPointerStartStringFileAddresses[0] = lastPointerAddressLineEdit.text()
// tableEndStringFileAddresses[0] = lastStringAddressLineEdit.text()

getSectionedCurrentContent()
if(getOrganizedSections()===1){
  removePointersTable()
  return
}
getGlobalExtractedStrings()
i=0

saveTableConfiguration(name)

await sleep(200);

loadPointersTable(`./Pointers Tables/${name + ".pt"}`)
}

function loadPointersTable(pathToPTFile){

  if(pathToPTFile!=undefined){

    selectedPTFile = path.resolve(pathToPTFile).split(path.sep).join("/");
    sectionNameLineEdit.setText(selectedPTFile.replace(/^.*[\\\/]/, "").replace(".pt",""))
  }else{
    const ptFileDialog = new QFileDialog()
    let goBack = true

    ptFileDialog.addEventListener("fileSelected",function(){

      if(ptFileDialog.selectedFiles().length!=0&&
        fs.lstatSync(ptFileDialog.selectedFiles()[0]).isDirectory()===false&&
        path.extname(`${ptFileDialog.selectedFiles()[0].toLowerCase()}`)===".pt"){

        
        selectedPTFile = ptFileDialog.selectedFiles();
        sectionNameLineEdit.setText(selectedPTFile[0].replace(/^.*[\\\/]/, "").replace(".pt",""))
        goBack = false
      }else{
        return
      }
    })

    ptFileDialog.setFileMode(1)
    ptFileDialog.setWindowTitle("Choose a .pt file")
    ptFileDialog.setAcceptMode(1)
    ptFileDialog.setNameFilter("*.pt")
    ptFileDialog.exec();

    if(goBack===true){
      return
    }
  }
  setDefaultValues(3)
  currentTableContent = (fs.readFileSync(`${selectedPTFile}`)).toString()
 
  pointersTableModeSettingsArr = currentTableContent.split(`\n`)
  filePathQLineEditRead.setText(`${pointersTableModeSettingsArr[8]}`)
  selectedFile= pointersTableModeSettingsArr[8]

  if(fs.existsSync(selectedFile)===false){
    errorMessageBox.setWindowTitle("Error")
    const selectedFileWraped = (selectedFile.match(/.{1,40}/g) || []).join("\n");

    errorMessageBox.setText(`ERROR! The file in the following path:\n\n${selectedFileWraped}\n\ndoes not longer exist, select a new one.`)
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()

    if(loadFile()===1){
      loadConfiguration()
      return
    }
  }

  start()
  saveSettingsButton.setEnabled(false)
  saveSettingsButton2.setEnabled(false)
  mainMenuAction1.setText("Return to Default state")
  mainMenuAction3.setEnabled(false)
  fileSizeMenu.setEnabled(true)

  firstPointerAddressLineEdit.setReadOnly(true)
  lastPointerAddressLineEdit.setReadOnly(true)
  firstStringAddressLineEdit.setReadOnly(true)
  lastStringAddressLineEdit.setReadOnly(true)
  filePathQLineEditRead.setReadOnly(true)

  sectionNameHeader = sectionNameLineEdit.text()

  pointersTableMode = true

  if(firstPointersTableAddressLineEdit.text().length=== 0){
    win.setFixedSize(728, 544);

    listWidget.setInlineStyle(`
    margin: 2px;
    min-height:440px;
    width:210px;
    flex:1;`)
  }
  rezisePointersTableLineEdit()
  sectionNameNumber.setText("1 ")
  loadPTConfiguration()
}

function loadPTConfiguration(){
  if(
    pointersTableModeSettingsArr[1] === undefined ||
    pointersTableModeSettingsArr[1] === '' ||
    pointersTableModeSettingsArr[4] === undefined ||
    pointersTableModeSettingsArr[4] === '' ||
    pointersTableModeSettingsArr[5] === undefined ||
    pointersTableModeSettingsArr[5] === '' ||
    pointersTableModeSettingsArr[8] === undefined ||
    pointersTableModeSettingsArr[8] === '' ||
    pointersTableModeSettingsArr[20] === undefined ||
    pointersTableModeSettingsArr[20] === ''){

    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("ERROR! Not valid data.\n")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
  }
  else{

    let i =20
    let k =0
  
    currentTableContent = (fs.readFileSync(`${selectedPTFile}`)).toString()
    pointersTableModeSettingsArr = currentTableContent.split(`\n`)
    


    while(pointersTableModeSettingsArr[i]!=''){

    selectedTablePointers[k]=pointersTableModeSettingsArr[i]

    k=k+1

    i=i+1

    }

    i=i+4
    k=0
    while(selectedTablePointers.length!=k){

      tableStartPointerFileAddresses[k] = pointersTableModeSettingsArr[i]
      tableEndPointerStartStringFileAddresses[k] = pointersTableModeSettingsArr[i+1]
      tableEndStringFileAddresses[k] = pointersTableModeSettingsArr[i+2]
      i=i+5
      k=k+1
    }
    postLastStringAddress = tableEndStringFileAddresses[k-1]
    globalOffset = Number(pointersTableModeSettingsArr[11])

    getSectionedCurrentContent()
    if(getOrganizedSections()===1){
      removePointersTable()
      return
    }
    getGlobalExtractedStrings()

    sectionNameLineEdit.setReadOnly(true)

    firstPointersTableAddressLineEdit.setText(pointersTableModeSettingsArr[4])
    lastPointersTableAddressLineEdit.setText(pointersTableModeSettingsArr[5])
    firstPointerAddressLineEdit.setText((parseInt(tableStartPointerFileAddresses[Number(sectionNameNumber.text())-1],16)+globalOffset).toString(16))
    lastPointerAddressLineEdit.setText(tableEndPointerStartStringFileAddresses[Number(sectionNameNumber.text())-1])
    firstStringAddressLineEdit.setText(tableEndPointerStartStringFileAddresses[Number(sectionNameNumber.text())-1])
    lastStringAddressLineEdit.setText(tableEndStringFileAddresses[Number(sectionNameNumber.text())-1])
    
 
    extractedTablePointersRaw = currentContent.slice(parseInt(firstPointersTableAddressLineEdit.text(),16),parseInt(lastPointersTableAddressLineEdit.text(),16))
    
    i=0
    while(Number(extractedTablePointersRaw.length)>1){

      extractedTablePointersIn4[i] = extractedTablePointersRaw.slice(0,4)

      if(extractedTablePointersRaw.slice(0,4).toString("hex") != "00000000"){
        extractedTablePointersIn4Non0[k] = extractedTablePointersRaw.slice(0,4)
        k=k+1
      }
      extractedTablePointersRaw = extractedTablePointersRaw.slice(4)

      i = i+1;
    }

    saveAndPrepare(pointersTableMode)

  }
}

function getSectionedCurrentContent(){
  let i =0
  sectionedCurrentContent = []
  
  while(selectedTablePointers.length>i){


    if(selectedTablePointers.length-1!=i){
      let firstPointerAddress1 
      let firstPointerAddress2 

      if(bigEndian.isChecked()===false){
        firstPointerAddress1 = Buffer.from(selectedTablePointers[i], "hex").readUIntLE(0,4)
        firstPointerAddress2 = Buffer.from(selectedTablePointers[i+1], "hex").readUIntLE(0,4)
  
        sectionedCurrentContent[i] = currentContent.slice(firstPointerAddress1,firstPointerAddress2)
  
      }else{
        firstPointerAddress1 = Buffer.from(selectedTablePointers[i], "hex").readUIntBE(0,4)
        firstPointerAddress2 = Buffer.from(selectedTablePointers[i+1], "hex").readUIntBE(0,4)
  
        sectionedCurrentContent[i] = currentContent.slice(firstPointerAddress1,firstPointerAddress2)
  
      }

    }else{
      sectionedCurrentContent[i] = currentContent.slice(Buffer.from(selectedTablePointers[i], "hex").readUIntLE(0,Buffer.from(selectedTablePointers[i], "hex").length),-1)

      break
    }
  
    i=i+1
  }

}

function saveTableConfiguration(name){

  if(organizedSections.length===0||organizedSections===undefined){
return
  }
  
  if(name===undefined){
    name = sectionNameLineEdit.text()
  }

let i = 0
 while(selectedTablePointers[i]!= undefined){
  selectedTablePointers[i] = selectedTablePointers[i].toUpperCase()
  i=i+1
 }

fs.writeFileSync(`./Pointers Tables/${name + ".pt"}`,
`TableName=
${name}

PointersTable=
${firstPointersTableAddressLineEdit.text()}
${lastPointersTableAddressLineEdit.text()}

FilePath=
${filePathQLineEditRead.text()}

GlobalOffset=
${globalOffset}

PL1=
0

PL2=
0

SelectedPointers=
${selectedTablePointers.join(',').replace(/,/g, '\n').split()}

Sections=

${organizedSections.join(',').replace(/,/g, '\n').split()}
`,{
  encoding: "binary",
  flag: "w",
  mode: 0o666
},
  (err) => {
    if (err){
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText("ERROR! The pointers table could not be created D:\n")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
      
    }
    else {
      console.log("Pointers table saved successfully\n");
    }
  })
}

function getOrganizedSections(){
  let i=0

  while(selectedTablePointers[i]!=undefined){

    if(bigEndian.isChecked()===true){
      tableStartPointerFileAddresses[i] = Buffer.from(selectedTablePointers[i], "hex").readUIntBE(0,Buffer.from(selectedTablePointers[i], "hex").length).toString(16)
      
      offset = Buffer.from(sectionedCurrentContent[i].slice(0+globalOffset,4+globalOffset)).readUIntBE(0,4)
      tableEndPointerStartStringFileAddresses[i]= (offset+ parseInt(tableStartPointerFileAddresses[i],16)).toString(16)
  
      if(selectedTablePointers[i+1]!=undefined){
        tableEndStringFileAddresses[i]= Buffer.from(selectedTablePointers[i+1], "hex").readUIntBE(0,Buffer.from(selectedTablePointers[i+1], "hex").length).toString(16)
  
      }else{
        tableEndStringFileAddresses[i]= postLastStringAddress
      }
    }else{
      
      tableStartPointerFileAddresses[i] = (Buffer.from(selectedTablePointers[i], "hex").readUIntLE(0,Buffer.from(selectedTablePointers[i], "hex").length)).toString(16)
      
      offset = Buffer.from(sectionedCurrentContent[i].slice(0+globalOffset,4+globalOffset),"hex").readUIntLE(0,4)
      tableEndPointerStartStringFileAddresses[i]= ( offset+parseInt(tableStartPointerFileAddresses[i],16)).toString(16)
  
      if(selectedTablePointers[i+1]!=undefined){
        tableEndStringFileAddresses[i]= (Buffer.from(selectedTablePointers[i+1], "hex").readUIntLE(0,Buffer.from(selectedTablePointers[i+1], "hex").length)).toString(16)
  
      }else{
        
        tableEndStringFileAddresses[i]= postLastStringAddress
      }
    }

    organizedSections[i] =`${i+1}\n`+
    tableStartPointerFileAddresses[i].toUpperCase()+"\n"+
    tableEndPointerStartStringFileAddresses[i].toUpperCase()  +"\n"+
    tableEndStringFileAddresses[i].toUpperCase()  +"\n"

    if(currentContent[parseInt(tableEndPointerStartStringFileAddresses[i],16)]===undefined){
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText(`ERROR! The starting string address (${tableEndPointerStartStringFileAddresses[i]})\npoints to a value that do not exist, returning\nto default state to prevent the corruption of the\n.pt file. If using the same .pt doesn't work please\ncreate a new Pointers Table for this file.`)
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
      return 1
    }

    i=i+1;
  }
}

function getGlobalExtractedStrings(){
  
  let i =0
  let oldAddresses = addressOfEachString
  while(tableEndPointerStartStringFileAddresses[i]!=undefined){

    globalExtractedStrings[i] = currentContent.slice(parseInt(tableEndPointerStartStringFileAddresses[i],16),parseInt(tableEndStringFileAddresses[i],16))
    globalAddressOfEachString[i] = stringAddressFuncWithoutPointers(currentContent,parseInt(tableEndPointerStartStringFileAddresses[i],16),parseInt(tableEndStringFileAddresses[i],16))

    i =i+1
  }
  addressOfEachString = oldAddresses
}

function removePointersTable(){
  saveSettingsButton.setEnabled(true)
  saveSettingsButton2.setEnabled(true)
  sectionNameLineEdit.setReadOnly(false)
  firstPointerAddressLineEdit.setReadOnly(false)
  lastPointerAddressLineEdit.setReadOnly(false)
  firstStringAddressLineEdit.setReadOnly(false)
  lastStringAddressLineEdit.setReadOnly(false)
  filePathQLineEditRead.setReadOnly(false)
  firstPointersTableAddressLineEdit.setText("")
  lastPointersTableAddressLineEdit.setText("")
  
  sectionDetailsLabel.setText(`Section name: String#N/A`)
  mainMenuAction1.setText("Load file")
  mainMenuAction3.setEnabled(true)
  fileSizeMenu.setEnabled(false)
  fileSizeMenuAction1.setChecked(true)
  fileSizeMenuAction2.setChecked(false)
  globalExtractedStrings = []

  sectionNameHeader = "Section name"
  pointersTableMode = false
  
  rezisePointersTableLineEdit()
  win.setFixedSize(728, 504);


  listWidget.setInlineStyle(`
  margin: 2px;
  min-height:400px;
  width:210px;
  flex:1;
  `)
  setDefaultValues(3)
  loadConfiguration()
  start()
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pointersTableUpdater(){
  let i=0
  //For the pointers table mode.
  if(extractedStrings.length>originalExtractedStringsLength){

    stringsOffset = extractedStrings.length-originalExtractedStringsLength
    i=0
    while(selectedTablePointers[i]!=undefined){
      oldSelectedTablePointers[i] = selectedTablePointers[i]
      i=i+1
    }

    if(Number(sectionNameNumber.text())+1!= undefined){
      i= Number(sectionNameNumber.text())
    }else{
      return
    }
    
    let temp1
    let temp2
    
    while(sectionedCurrentContent[i]!=undefined){

      if(bigEndian.isChecked()===false){

        temp1 = Buffer.from(selectedTablePointers[i],"hex").readUIntLE(0,4) + stringsOffset - stringsOldOffset
        temp2 = temp1.toString(16).toUpperCase().padStart(selectedTablePointers[i].length, '0')
        selectedTablePointers[i] = temp2.match(/.{1,2}/g).reverse().join('')
      
      }else{

        temp1 = Buffer.from(selectedTablePointers[i],"hex").readUIntBE(0,4) + stringsOffset - stringsOldOffset
        temp2 = temp1.toString(16).toUpperCase().padStart(selectedTablePointers[i].length, '0')
        selectedTablePointers[i] = temp2.match(/.{1,2}/g).reverse().join('')
      }

    i=i+1
    }

    i =0
    let k =0

    while(selectedTablePointers[i]!= undefined){

      if(selectedTablePointers[i].toString("hex").toUpperCase()!=oldSelectedTablePointers[i]){
        k=0
        while(extractedTablePointersIn4[k]!=undefined){

          if(extractedTablePointersIn4[k].toString("hex").toUpperCase()===oldSelectedTablePointers[i].toUpperCase()){

            extractedTablePointersIn4[k] = Buffer.from(selectedTablePointers[i],"hex")

          }
          k=k+1
        }

      }
      i=i+1
    }
  
    i =0
    while(oldSelectedTablePointers[i]!=undefined){
      oldSelectedTablePointers[i] = selectedTablePointers[i]
      i=i+1
    } 
    i =0
    
    while(selectedTablePointers[i]!=undefined){

      selectedTablePointers[i] = selectedTablePointers[i].toString("hex")

      i=i+1
    }


    let tempCurrentContent = currentContent.toString("binary")

    extractedTablePointers  = Buffer.concat(extractedTablePointersIn4)

    let tempExtractedTablePointers = extractedTablePointers.toString("binary")

    lastStringAddressLineEdit.setText((parseInt(lastStringAddressLineEdit.text(),16)+stringsOffset - stringsOldOffset).toString(16))

    tempCurrentContent =  tempCurrentContent.substring(0,parseInt(firstPointersTableAddressLineEdit.text(),16)) + tempExtractedTablePointers +tempCurrentContent.substring(parseInt(lastPointersTableAddressLineEdit.text(),16))
    currentContent = Buffer.from(tempCurrentContent,"binary")
  }
  getSectionedCurrentContent()
  if(getOrganizedSections()===1){
    removePointersTable()
    return
  }
  getGlobalExtractedStrings()
  stringsOldOffset = stringsOffset

  if(exportAllMode===false){
    saveTableConfiguration()
  }
}

function setShiftJISEncoding(){
  if(encodingMenuAction2.isChecked()===true){
    encodingMenuAction1.setChecked(false)
    encodingMenuAction1.setEnabled(true)
    encodingMenuAction2.setEnabled(false)
    encodingMenu.setTitle("Encoding: Shift-JIS")
    UTF8Encoding = false
    shiftJISEncoding = true
  }

  if(listWidget.count()!=0 && extractedPointersIn4[0]!= undefined){
    console.log("Changing encoding to Shift-JIS 1")
    saveAndPrepare()
  }else if(listWidget.count()!=0 && extractedPointersIn4[0]=== undefined){
    console.log("Changing encoding to Shift-JIS 2")
    saveAndPrepare2()
  }
}

function setUTF8Encoding(){
  if(encodingMenuAction1.isChecked()===true){
    encodingMenuAction2.setChecked(false)
    encodingMenuAction2.setEnabled(true)
    encodingMenuAction1.setEnabled(false)
    encodingMenu.setTitle("Encoding: UTF-8")
    UTF8Encoding = true
    shiftJISEncoding = false
  }
  if(listWidget.count()!=0 && extractedPointersIn4[0]!= undefined){
    console.log("Changing encoding to UTF-8 1")
    saveAndPrepare()
  }else if(listWidget.count()!=0 && extractedPointersIn4[0]=== undefined){
    console.log("Changing encoding to UTF-8 2")
    saveAndPrepare2()
  }
}

function setEUCJPEncoding(){

}

function setJISncoding(){

}

function setUTF16Encoding(){

}

function setUTF16BEEncoding(){

}

function setUTF16LEEncoding(){

}

function fileSize(options){
  
  if(options===0){

    if(fileSizeMenuAction1.isChecked()===true){
      fileSizeMenuAction2.setChecked(false)
      fileSizeMenuAction2.setEnabled(true)
      fileSizeMenuAction1.setEnabled(false)
      fileSizeMenu.setTitle("File Size: Keep")
    }
  }else{

    if(fileSizeMenuAction2.isChecked()===true){
      fileSizeMenuAction1.setChecked(false)
      fileSizeMenuAction1.setEnabled(true)
      fileSizeMenuAction2.setEnabled(false)
      fileSizeMenu.setTitle("File Size: Don't keep")
    }
  }
}

async function alignTwoCsv(){

  let selectedCsv1 = csvSelection()

  if(selectedCsv1===null){
    return
  }

  let selectedCsv2 = csvSelection()

  if(selectedCsv2===null){
    return
  }

  let csvContentInHex1 = Buffer.from(fs.readFileSync(`${selectedCsv1}`).toString("hex").replace("efbbbf0d0a","").replace("efbbbf",""),"hex").toString("utf8")

  let csvContentInHex2 = Buffer.from(fs.readFileSync(`${selectedCsv2}`).toString("hex").replace("efbbbf0d0a","").replace("efbbbf",""),"hex").toString("utf8")
  
  let csvContentInHex1Style
  let csvContentInHex2Style

  if(csvContentInHex1.split("\n\n").length>csvContentInHex1.split("\r\n\r\n").length&&csvContentInHex1.split("\n\n").length>csvContentInHex1.split("\r\n;\r\n").length){
    csvContentInHex1 = csvContentInHex1.split("\n\n")
    csvContentInHex1Style=0
  }else if(csvContentInHex1.split("\r\n;\r\n").length>csvContentInHex1.split("\r\n\r\n").length&&csvContentInHex1.split("\r\n;\r\n").length>csvContentInHex1.split("\n\n").length){
    csvContentInHex1 = csvContentInHex1.split("\r\n;\r\n")
    csvContentInHex1Style=1
  }else{
    csvContentInHex1 = csvContentInHex1.split("\r\n\r\n")
    csvContentInHex1Style=2
  }

  if(csvContentInHex2.split("\n\n").length>csvContentInHex2.split("\r\n\r\n").length&&csvContentInHex2.split("\n\n").length>csvContentInHex2.split("\r\n;\r\n").length){
    csvContentInHex2 = csvContentInHex2.split("\n\n")
    csvContentInHex2Style=0
  }else if(csvContentInHex2.split("\r\n;\r\n").length>csvContentInHex2.split("\r\n\r\n").length&&csvContentInHex2.split("\r\n;\r\n").length>csvContentInHex2.split("\n\n").length){
    csvContentInHex2 = csvContentInHex2.split("\r\n;\r\n")
    csvContentInHex2Style=1
  }else{
    csvContentInHex2 = csvContentInHex2.split("\r\n\r\n")
    csvContentInHex2Style=2
  }

  let i = 0 
  while(csvContentInHex1[i]!=undefined){
      csvContentInHex1[i] = checkForSemicolons(csvContentInHex1[i],csvContentInHex1Style)
      i=i+1
    }
    i =0
  while(csvContentInHex2[i]!=undefined){
    csvContentInHex2[i] = checkForSemicolons(csvContentInHex2[i],csvContentInHex2Style)
    i=i+1
  }
  i=0
  let finalCsv = []
  let tempCsvContent1
  let tempCsvContent2 
  while(csvContentInHex1[i]!=undefined || csvContentInHex2[i]!=undefined){

    if(csvContentInHex1[i]===undefined){
      csvContentInHex1[i] = ""
    }

    if(csvContentInHex2[i]===undefined){
      csvContentInHex2[i] = ""
    }

    if(csvContentInHex1Style===0){
      tempCsvContent1 = csvContentInHex1[i].split("\n")
    }else if(csvContentInHex1Style===1){

      if(csvContentInHex1[i].substring(0,3)===";\r\n"){
        csvContentInHex1[i] = csvContentInHex1[i].replace(";\r\n","")
      }
      tempCsvContent1 = csvContentInHex1[i].split(";\r\n")
      
    }else{

      if(csvContentInHex1[i].substring(0,2)==="\r\n"){
        csvContentInHex1[i] = csvContentInHex1[i].replace("\r\n","")
      }

      tempCsvContent1 = csvContentInHex1[i].split("\r\n")
    }

    if(csvContentInHex2Style===0){
      tempCsvContent2 = csvContentInHex2[i].split("\n")
    }else if(csvContentInHex2Style===1){

      if(csvContentInHex2[i].substring(0,3)===";\r\n"){
        csvContentInHex2[i] = csvContentInHex2[i].replace(";\r\n","")
      }
      tempCsvContent2 = csvContentInHex2[i].split(";\r\n")

    }else{

      if(csvContentInHex2[i].substring(0,2)==="\r\n"){
        csvContentInHex2[i] = csvContentInHex2[i].replace("\r\n","")
      }
      tempCsvContent2 = csvContentInHex2[i].split("\r\n")
    }
    
    let tempCsvContent3 = []
    let k = 0
    while(tempCsvContent1[k]!=undefined||tempCsvContent2[k]!=undefined){

      if(tempCsvContent1[k]===undefined){
        tempCsvContent1[k] = ""
      }else if(tempCsvContent2[k]===undefined){
        tempCsvContent2[k] = ""
      }

      tempCsvContent3[k] = tempCsvContent1[k]+ ";" + tempCsvContent2[k] +"\n"

      k=k+1
    }
    tempCsvContent3[k-1] = tempCsvContent3[k-1] + "\n"

    if(Array.isArray(tempCsvContent3)===true){
      finalCsv[i]  = tempCsvContent3.join("")
    }else{
      finalCsv[i]  = tempCsvContent3
    }

    i=i+1
  }

  fs.writeFile(`./mergedData.txt`,`${finalCsv.join("")}`,{
    encoding: "utf8",
    flag: "w",
    mode: 0o666
  },(err) => {

    if (err){
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText("ERROR! maybe the file is being used?")
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
    }
    else{
      errorMessageBox.setWindowTitle("Task completed")
      errorMessageBox.setText(`The data has been exported to the root folder\nsucessfully.`)
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
    }
  })
}

function sectionNameButtonIsBeingPressed(options) {

  if(options===0){
    clearInterval(timer);
    timer = setInterval(function() {
      if(sectionNameUpButton.isDown()===true){
        plus1(pointersTableMode)
      }else{
        plus1(pointersTableMode)
        clearInterval(this)
      }
    }, 100)
  }else{
    clearInterval(timer);
    timer = setInterval(function() {
      if(sectionNameDownButton.isDown()===true){
        minus1(pointersTableMode)
      }else{
        minus1(pointersTableMode)
        clearInterval(this)
      }
    }, 100)
  }
}

//Toolbar and main Window--------------------------------------------------------
const win = new QMainWindow;
win.setFixedSize(728, 504);
win.setWindowTitle('MH Pointers Tool');

const mainMenu = new QMenu()

const mainMenuAction1 = new QAction();
const mainMenuAction2 = new QAction();
const mainMenuAction3 = new QAction();
const mainMenuAction4 = new QAction();
const mainMenuAction5 = new QAction();
const mainMenuAction6 = new QAction();

mainMenu.setTitle("Menu")
mainMenuAction1.setText('Load file');
mainMenuAction2.setText('Load Pointers Table');
mainMenuAction3.setText('Create a Pointers Table for this file');
mainMenuAction4.setText('Align two csv by rows');
mainMenuAction5.setText("About");
mainMenuAction6.setText('Exit');

mainMenu.addAction(mainMenuAction1)
mainMenu.addAction(mainMenuAction2) 
mainMenu.addAction(mainMenuAction3)
mainMenu.addAction(mainMenuAction4)
mainMenu.addAction(mainMenuAction5)
mainMenu.addAction(mainMenuAction6)

const encodingMenu = new QMenu()
encodingMenu.setTitle("Encoding: UTF-8")
const encodingMenuAction1 = new QAction();
const encodingMenuAction2 = new QAction();

//QActionGroup() Is not currently ported
// const encodingMenuActionGroup  = QActionGroup()
// encodingMenuActionGroup.addAction(encodingMenuAction1)
// encodingMenuActionGroup.addAction(encodingMenuAction2)

encodingMenuAction1.setText('UTF-8');
encodingMenuAction2.setText('Shift-JIS');

encodingMenuAction1.setCheckable(true);
encodingMenuAction2.setCheckable(true)
encodingMenuAction1.setChecked(true)
encodingMenuAction1.setEnabled(false)

const fileSizeMenu = new QMenu()
fileSizeMenu.setDisabled(true)
fileSizeMenu.setTitle("File size: Keep")
fileSizeMenu.setToolTip("Maintain the file size when a string is overwritten by a bigger one.\nBy default is keep.")
const fileSizeMenuAction1 = new QAction();
const fileSizeMenuAction2 = new QAction();

fileSizeMenu.addAction(fileSizeMenuAction1) 
fileSizeMenu.addAction(fileSizeMenuAction2)

fileSizeMenuAction1.setText('Keep');
fileSizeMenuAction1.setCheckable(true)
fileSizeMenuAction1.setChecked(true)
fileSizeMenuAction1.setEnabled(false)

fileSizeMenuAction2.setText("Don't keep");
fileSizeMenuAction2.setCheckable(true)

encodingMenu.addAction(encodingMenuAction1) 
encodingMenu.addAction(encodingMenuAction2)

const menuBar = new QMenuBar()
menuBar.addMenu(mainMenu) 
menuBar.addMenu(encodingMenu) 
menuBar.addMenu(fileSizeMenu)

win.setMenuBar(menuBar);

const qicon = new QIcon()
qicon.addFile("./pngs/logo.png")
win.setWindowIcon(qicon)
const rootView = new QWidget() //The most external square
const mainLayout = new FlexLayout();
rootView.setLayout(mainLayout)
rootView.setInlineStyle(`
flex-direction: row;
`)

//load .pt
mainMenuAction2.addEventListener("triggered",function (){loadPointersTable()})

//create .pt
mainMenuAction3.addEventListener("triggered",function () {getPointersTableData()})
mainMenuAction3.setEnabled(false)

//encoding
encodingMenuAction1.addEventListener("triggered",function () {setUTF8Encoding()})
encodingMenuAction2.addEventListener("triggered",function () {setShiftJISEncoding()})


//file size
fileSizeMenuAction1.addEventListener("triggered",function () {fileSize(0)})
fileSizeMenuAction2.addEventListener("triggered",function () {fileSize(1)})

//Align two csv by rows----------------------------------------------------------

mainMenuAction4.addEventListener("triggered", function (){
  alignTwoCsv()
})

//About----------------------------------------------------------
const aboutDialog = new QDialog()
aboutDialog.setModal(true)
aboutDialog.setWindowTitle('About')
aboutDialog.setInlineStyle(`
background-color:white;
`)
mainMenuAction5.addEventListener("triggered",function (){
  aboutDialog.exec()
})

const aboutTitleWidget   = new QWidget()
const aboutGitHubWidget  = new QWidget()
const aboutGitHubLinkWidget = new QWidget()
const aboutTextWidget   = new QWidget()
const aboutDonateWidget = new QWidget()
const aboutMadeByWidget = new QWidget()

const aboutDialogLayout = new QBoxLayout(2)

aboutDialog.setLayout(aboutDialogLayout)

aboutTitleWidget.setObjectName("aboutSquares")
aboutGitHubWidget.setObjectName("aboutSquares")
aboutGitHubLinkWidget.setObjectName("aboutSquares")
aboutTextWidget.setObjectName("aboutSquares")
aboutDonateWidget.setObjectName("aboutSquares")
aboutMadeByWidget.setObjectName("aboutSquares")

aboutDialogLayout.addWidget(aboutTitleWidget)
aboutDialogLayout.addWidget(aboutGitHubWidget)
aboutDialogLayout.addWidget(aboutGitHubLinkWidget)
aboutDialogLayout.addWidget(aboutTextWidget)
aboutDialogLayout.addWidget(aboutDonateWidget)
aboutDialogLayout.addWidget(aboutMadeByWidget)

const aboutTitleLabel = new QLabel()
aboutTitleLabel.setTextInteractionFlags(1)
aboutTitleLabel.setText("MH Pointers Tool" +" - Ver. 1.1.0")
const aboutTitleLayout = new QBoxLayout(0)
aboutTitleLayout.addWidget(aboutTitleLabel)
aboutTitleWidget.setLayout(aboutTitleLayout)
aboutTitleLabel.setAlignment(132)
aboutTitleLabel.setInlineStyle(`
font-weight:bold;
`)

const aboutGitHubLabel = new QLabel()
aboutGitHubLabel.setTextInteractionFlags(1)
aboutGitHubLabel.setText("A tool made to do the translation work easier.\nIt can make a list of strings to edit them directly\nwhile edit it pointers automatically.")
const aboutGitHubLayout = new QBoxLayout(0)
aboutGitHubLayout.addWidget(aboutGitHubLabel)
aboutGitHubWidget.setLayout(aboutGitHubLayout)

const aboutGitHubLinkLabel = new QLabel()
aboutGitHubLinkLabel.setText(`For details/<a href="https://github.com/amaillo/MH-Pointers-Tool/issues">bug reports</a> check the <a href="https://github.com/amaillo/MH-Pointers-Tool">GitHub</a> page.`)
aboutGitHubLinkLabel.setOpenExternalLinks(true)
const aboutGitHubLinkLayout = new QBoxLayout(0)
aboutGitHubLinkLayout.addWidget(aboutGitHubLinkLabel)
aboutGitHubLinkWidget.setLayout(aboutGitHubLinkLayout)

const aboutTextLabel = new QLabel()
aboutTextLabel.setTextInteractionFlags(1)
aboutTextLabel.setText("Hey! If you found this tool useful and want\ngive something in return, you can use these\nplatforms to make a tip! :D")
const aboutTextLayout = new QBoxLayout(0)
aboutTextLayout.addWidget(aboutTextLabel)
aboutTextWidget.setLayout(aboutTextLayout)

const aboutDonateLabel = new QLabel()
aboutDonateLabel.setText('<a href="https://ko-fi.com/amaillo">Ko-fi</a>' + "  |  Hive wallet: amaillo")
aboutDonateLabel.setAlignment(132)
aboutDonateLabel.setOpenExternalLinks(true)
const aboutDonateLayout = new QBoxLayout(0)
aboutDonateLayout.addWidget(aboutDonateLabel)
aboutDonateWidget.setLayout(aboutDonateLayout)

const aboutMadeByLabel = new QLabel()
aboutMadeByLabel.setTextInteractionFlags(1)
aboutMadeByLabel.setText("Made by amaillo (llamailloll@gmail.com).\nThis software is under the MIT License.")
const aboutMadeByLayout = new QBoxLayout(0)
aboutMadeByLayout.addWidget(aboutMadeByLabel)
aboutMadeByWidget.setLayout(aboutMadeByLayout)

//Left Widget Area (LWA)----------------------------------------------------------
const leftWidget = new QWidget();
const leftWidgetLayout = new FlexLayout();
leftWidget.setLayout(leftWidgetLayout)
mainLayout.addWidget(leftWidget);

leftWidget.setInlineStyle(`
border-color:black;
border-style:solid;
border-left-width:3px;
border-top-width:3px;
border-right-width:1px;
border-bottom-width:3px;
`)

//LWA:Search string---------------------------------------------------------------
const searchStringArea = new QWidget();
leftWidgetLayout.addWidget(searchStringArea)
searchStringArea.setInlineStyle(`
flex:1;
`)

const searchStringLayout = new QBoxLayout(0);
searchStringArea.setLayout(searchStringLayout)

const searchLineEdit = new QLineEdit();
searchLineEdit.setPlaceholderText("Search...")
searchStringLayout.addWidget(searchLineEdit)
searchLineEdit.setToolTip("Search for words or sentences in the list of strings.\nSometimes need to delete a letter of the sentence\nthat you are searching to work, will be fixed later.")

const searchButtont = new QPushButton();
searchButtont.setText("Next")
searchStringLayout.addWidget(searchButtont)

//Takes the input from searchLineEdit to search for the next item in main list widget
//that contains the same text.
searchButtont.addEventListener("clicked",function (){

  textToSearch = searchLineEdit.text()

  if(textToSearch != "" && textToSearch != textToSearchOld){

    if(listWidget.currentRow() >= 0){
      searchSet = listWidget.currentRow()
    }else{
      searchSet= 0
    }
    saveItemsInArr(textToSearch)
    setNextItem()
  }else{

    setNextItem()
  }

  textToSearchOld = textToSearch;
});


//LWA:List Widget---------------------------------------------------------------
const listWidget = new QListWidget()
leftWidgetLayout.addWidget(listWidget)
const listWidgetLayout = new FlexLayout();
listWidget.setLayout(listWidgetLayout)
listWidget.setInlineStyle(`
margin: 2px;
min-height:400px;
width:210px;
flex:1;
`)

//When a item in the main list widget is clicked, all the relevant info for that string
// is set.
listWidget.addEventListener("clicked",() => {
  
  stringEditorTextEdit.setPlainText(listWidget.currentItem().text())

  if(sectionNameHeader != "Section name"){

    sectionDetailsLabel.setText(`${sectionNameHeader}: String#${listWidget.currentRow()+1}`)
  }else{

    sectionDetailsLabel.setText(`Section name: String#${listWidget.currentRow()+1}`)
  }

  if(addressOfEachStringInMemory[listWidget.currentRow()] != undefined){
    stringAdressLabel.setText(`String Address: ${addressOfEachString[listWidget.currentRow()]}`+"/"+ "0x" + `${addressOfEachStringInMemory[listWidget.currentRow()].toString(16).toUpperCase().replaceAll("00","")}`)
  }else{
    stringAdressLabel.setText(`String Address: ${addressOfEachString[listWidget.currentRow()]}`)
  }


  if(pointersHexValues[listWidget.currentRow()] != undefined){
    pointerValuesLabel.setText(`Pointer HexValues: ${pointersHexValues[listWidget.currentRow()].toString("hex").toUpperCase()}`)

  }

  highlightPointers()
})


//Mid Widget Area (MWA)-----------------------------------------------------------
const midWidget = new QWidget();
const midWidgetLayout = new FlexLayout();
midWidget.setLayout(midWidgetLayout)
mainLayout.addWidget(midWidget);
midWidget.setInlineStyle(`
border-color:black;
border-style:solid;
border-left-width:2px;
border-top-width:3px;
border-right-width:2px;
border-bottom-width:3px;
width:270px;
`)

//MWA:Save button-----------------------------------------------------------------
const save = new QWidget();
midWidgetLayout.addWidget(save)
save.setInlineStyle(`
flex:1;
`)

const saveLayout = new QBoxLayout(0);
save.setLayout(saveLayout)
saveLayout.setContentsMargins(0,0,0,0)

const saveButton = new QPushButton();
saveButton.setText(`SAVE`)
saveLayout.addWidget(saveButton)
saveButton.setToolTip("Saves in the file the changes made to the current string.")
//Self-explanatory
saveButton.addEventListener("clicked", saveProgress)

//MWA:Section details------------------------------------------------------------
const sectionDetails = new QWidget();
midWidgetLayout.addWidget(sectionDetails)
sectionDetails.setInlineStyle(`
flex:1;
border-color:black;
border-style:solid;
border-top-width:1px;
border-bottom-width:1px;
`)

const sectionDetailsLayout = new QBoxLayout(0);
sectionDetails.setLayout(sectionDetailsLayout)
sectionDetails.setContentsMargins(0,0,0,0)
const sectionDetailsLabel = new QLabel();
sectionDetailsLabel.setText(`Section name: String#N/A`)
sectionDetailsLayout.addWidget(sectionDetailsLabel)

//MWA:String editor------------------------------------------------------------
const stringEditor = new QWidget();
midWidgetLayout.addWidget(stringEditor)
stringEditor.setInlineStyle(`
flex:6;
`)

const stringEditorLayout = new QBoxLayout(0);
stringEditor.setLayout(stringEditorLayout)

const stringEditorTextEdit = new QPlainTextEdit();
stringEditorTextEdit.setPlaceholderText("String editor")
stringEditorLayout.addWidget(stringEditorTextEdit)
stringEditorTextEdit.setInlineStyle(`
font-size:13px;
height:200px;
`)

const clipboard = QApplication.clipboard();

//If for some reason this program is focused when the clipboard is
//empty, the clipboard is changed to " ". For some reason if you try to
//paste a empty clipboard to a QPlainTextEdit causes a crash, this measure avoid that.
stringEditorTextEdit.addEventListener("FocusIn",function(){
if(clipboard.text(QClipboardMode.Clipboard) ===""){
  clipboard.setText(" ")
}
})

//MWA:Characters per line------------------------------------------------------------
const characters16 = new QWidget();
midWidgetLayout.addWidget(characters16)
characters16.setInlineStyle(`
height:45px;
`)

const characters16Layout = new QBoxLayout(0);
characters16.setLayout(characters16Layout)

const choosedCharacters = new QLineEdit()
choosedCharacters.setPlaceholderText("0-99")
choosedCharacters.setInputMask("99")
characters16Layout.addWidget(choosedCharacters)

const characters16Button = new QPushButton();
characters16Button.setText(`characters per line`)
characters16Layout.addWidget(characters16Button)

characters16Button.addEventListener('clicked',function (){specificCharactersPerLine(0)});
// stringEditorTextEdit.addEventListener("cursorPositionChanged",function (){
// })


//MWA:Space Left------------------------------------------------------------
const spaceLeft = new QWidget();
midWidgetLayout.addWidget(spaceLeft)

spaceLeft.setInlineStyle(`
border-color:black;
border-style:solid;
border-top-width:1px;
border-bottom-width:1px;
flex:1;
`)

const spaceLeftLayout = new QBoxLayout(0);
spaceLeft.setLayout(spaceLeftLayout)

const spaceLeftLabel = new QLabel();
spaceLeftLabel.setText(`Space left: N/A`)
spaceLeftLabel.setTextInteractionFlags(1)
spaceLeftLayout.addWidget(spaceLeftLabel)

//MWA:Pointer Hex Values----------------------------------------------------
const pointerValues = new QWidget();
midWidgetLayout.addWidget(pointerValues)
pointerValues.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
flex:1;
`)

const pointerValuesLayout = new QBoxLayout(0);
pointerValues.setLayout(pointerValuesLayout)

const pointerValuesLabel = new QLabel();
pointerValuesLabel.setText(`Pointer HexValues: N/A`)
pointerValuesLabel.setTextInteractionFlags(1)
pointerValuesLayout.addWidget(pointerValuesLabel)


//MWA:Pointers address------------------------------------------------------
const pointerAddress = new QWidget();
midWidgetLayout.addWidget(pointerAddress)
pointerAddress.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
flex:1;
`)

const pointerAddressLayout = new QBoxLayout(0);
pointerAddress.setLayout(pointerAddressLayout)

const pointerAddressLabel = new QLabel();
pointerAddressLabel.setText("Pointer Address: N/A")
pointerAddressLabel.setTextInteractionFlags(1)
pointerAddressLayout.addWidget(pointerAddressLabel)

//MWA:String address------------------------------------------------------
const stringAddress = new QWidget();
midWidgetLayout.addWidget(stringAddress)
stringAddress.setInlineStyle(`
flex:1;
`)
const stringAddressLayout = new QBoxLayout(0);
stringAddress.setLayout(stringAddressLayout)

const stringAdressLabel = new QLabel();

stringAdressLabel.setText(`String Address: File/"RAM" (Not accurate)`)
stringAdressLabel.setTextInteractionFlags(1)
stringAddressLayout.addWidget(stringAdressLabel)


//Right Widget Area (RWA)--------------------------------------------------------
const rightWidget = new QWidget();
mainLayout.addWidget(rightWidget);

const rightWidgetLayout = new FlexLayout();
rightWidget.setLayout(rightWidgetLayout)

rightWidget.setInlineStyle(`
width:240px;
`)

//RWA: Section Name---------------------------------------------------------------
const sectionNameLabel = new QLabel()
sectionNameLabel.setAlignment(132)
sectionNameLabel.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

rightWidget.setInlineStyle(`
border-color:black;
border-style:solid;
border-left-width:1px;
border-top-width:3px;
border-right-width:3px;
border-bottom-width:3px;
`)


sectionNameLabel.setText("Section name")
const sectionName2 = new QWidget();
const sectionNameLayout2 = new FlexLayout();
sectionName2.setLayout(sectionNameLayout2)
rightWidgetLayout.addWidget(sectionNameLabel)
rightWidgetLayout.addWidget(sectionName2)
sectionName2.setInlineStyle(`
flex-direction: row;
`)

const sectionName = new QWidget();
const sectionNameLayout = new FlexLayout();
sectionName.setLayout(sectionNameLayout)
rightWidgetLayout.addWidget(sectionName)
sectionName.setInlineStyle(`
flex-direction: row;
width:226px;
`)

const sectionNameLineEdit = new QLineEdit();
sectionNameLineEdit.setPlaceholderText("Section name")
sectionNameLineEdit.setToolTip("Adds a name to the section of the file\nthat is being translated.")
sectionNameLayout.addWidget(sectionNameLineEdit)
const sectionNameUpButton = new QPushButton();
sectionNameUpButton.setText("↑")
sectionNameLayout.addWidget(sectionNameUpButton)
const sectionNameDownButton = new QPushButton();
sectionNameDownButton.setText("↓")
sectionNameLayout.addWidget(sectionNameDownButton)
const sectionNameNumber = new QLabel();

sectionNameNumber.setText("1 ")
sectionNameNumber.setInlineStyle(`
margin-left:2px;
font-weight:bold;
`)
sectionNameLayout.addWidget(sectionNameNumber)

sectionNameUpButton.setInlineStyle(`
width:32px;
`)
sectionNameDownButton.setInlineStyle(`
width:32px;
`)

sectionNameUpButton.addEventListener("pressed",function () {
  sectionNameButtonIsBeingPressed(0)
})
sectionNameDownButton.addEventListener("pressed",function () {
  sectionNameButtonIsBeingPressed(1)
})


//RWA:Table Pointers Address---------------------------------------------------------------

const pointersTableAddresses = new QWidget();
const pointersTableAddressesMainWidget = new QWidget();
const pointersTableAddressesLayout = new FlexLayout();
const pointersTableAddressesMainLayout = new FlexLayout();

pointersTableAddresses.setLayout(pointersTableAddressesLayout)
pointersTableAddressesMainWidget.setLayout(pointersTableAddressesMainLayout)
rightWidgetLayout.addWidget(pointersTableAddressesMainWidget)

pointersTableAddresses.setInlineStyle(`
flex-direction:column;
height:0px;
`)


function rezisePointersTableLineEdit() {

  if(pointersTableMode===true){
    pointersTableAddresses.setInlineStyle(`
    flex-direction:column;
    height:40x;
    `)
  }else{
    pointersTableAddresses.setInlineStyle(`
    flex-direction:column;
    height:0x;
    `)
  }

}

const firstPointersTableAddressLineEdit = new QLineEdit();
const lastPointersTableAddressLineEdit = new QLineEdit();
firstPointersTableAddressLineEdit.setReadOnly(true)
lastPointersTableAddressLineEdit.setReadOnly(true)
firstPointersTableAddressLineEdit.setToolTip("First pointer table address in the file, for the section that you will translate (without 0x).")
firstPointersTableAddressLineEdit.setPlaceholderText("First pointer table address")
lastPointersTableAddressLineEdit.setPlaceholderText("Post-last pointer table address")
lastPointersTableAddressLineEdit.setToolTip("Post-last pointer table address in the file, for the section that you will translate (without 0x).")
lastPointersTableAddressLineEdit.setInlineStyle(`
width:118px;
font-size:11px;
`)
firstPointersTableAddressLineEdit.setInlineStyle(`
width:119px;
font-size:11px;
`)


const pointersTableAddressTitleWidget = new QWidget()
const pointersTableAddressLineEditWidget = new QWidget()


pointersTableAddressesMainLayout.addWidget(pointersTableAddresses)
pointersTableAddressesLayout.addWidget(pointersTableAddressTitleWidget)
pointersTableAddressesLayout.addWidget(pointersTableAddressLineEditWidget)

const pointersTableAddressTitleWidgetLayout = new FlexLayout()
const pointersTableAddressLineEditWidgetLayout = new FlexLayout()

pointersTableAddressLineEditWidget.setInlineStyle(`
flex-direction:row;
`)

pointersTableAddressTitleWidget.setLayout(pointersTableAddressTitleWidgetLayout)
pointersTableAddressLineEditWidget.setLayout(pointersTableAddressLineEditWidgetLayout)

const pointerTableAddressLineEditTitle = new QLabel();
pointerTableAddressLineEditTitle.setText("Pointers Table address *")
pointerTableAddressLineEditTitle.setAlignment(132)
pointerTableAddressLineEditTitle.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

pointersTableAddressTitleWidgetLayout.addWidget(pointerTableAddressLineEditTitle)
pointersTableAddressLineEditWidgetLayout.addWidget(firstPointersTableAddressLineEdit)
pointersTableAddressLineEditWidgetLayout.addWidget(lastPointersTableAddressLineEdit)

//RWA:Pointers Address---------------------------------------------------------------
const pointerAdresses = new QWidget();
const pointerAdressesLayout = new FlexLayout();
pointerAdresses.setLayout(pointerAdressesLayout)
rightWidgetLayout.addWidget(pointerAdresses)
pointerAdresses.setInlineStyle(`
flex-direction:column;
`)

const firstPointerAddressLineEdit = new QLineEdit();
const lastPointerAddressLineEdit = new QLineEdit();
firstPointerAddressLineEdit.setToolTip("First pointer address in the file, for the section that you will translate (without 0x).")
firstPointerAddressLineEdit.setPlaceholderText("First pointer address")
lastPointerAddressLineEdit.setPlaceholderText("Post-last pointer address")
lastPointerAddressLineEdit.setToolTip("Post-last pointer address in the file, for the section that you will translate (without 0x).")
lastPointerAddressLineEdit.setInlineStyle(`
width:118px;
font-size:11px;
`)
firstPointerAddressLineEdit.setInlineStyle(`
width:119px;
font-size:11px;
`)


const pointerAddressTitleWidget = new QWidget()
const pointerAddressLineEditWidget = new QWidget()

pointerAdressesLayout.addWidget(pointerAddressTitleWidget)
pointerAdressesLayout.addWidget(pointerAddressLineEditWidget)

const pointerAddressTitleWidgetLayout = new FlexLayout()
const pointerAddressLineEditWidgetLayout = new FlexLayout()

pointerAddressLineEditWidget.setInlineStyle(`
flex-direction:row;
`)

pointerAddressTitleWidget.setLayout(pointerAddressTitleWidgetLayout)
pointerAddressLineEditWidget.setLayout(pointerAddressLineEditWidgetLayout)

const pointerAddressLineEditTitle = new QLabel();
pointerAddressLineEditTitle.setText("Pointers address")
pointerAddressLineEditTitle.setAlignment(132)
pointerAddressLineEditTitle.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

pointerAddressTitleWidgetLayout.addWidget(pointerAddressLineEditTitle)
pointerAddressLineEditWidgetLayout.addWidget(firstPointerAddressLineEdit)
pointerAddressLineEditWidgetLayout.addWidget(lastPointerAddressLineEdit)


//RWA: Strings Address-----------------------------------------------------
const stringAdressesTitle = new QWidget();
const stringAdressesLayout2 = new FlexLayout();
stringAdressesTitle.setLayout(stringAdressesLayout2)
rightWidgetLayout.addWidget(stringAdressesTitle)

const stringAdressesTitleLabel = new QLabel()
stringAdressesTitleLabel.setText("Strings address *")
stringAdressesTitleLabel.setAlignment(132)
stringAdressesTitleLabel.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

stringAdressesLayout2.addWidget(stringAdressesTitleLabel)

const stringAdresses = new QWidget();
const stringAdressesLayout = new FlexLayout();
stringAdresses.setLayout(stringAdressesLayout)
rightWidgetLayout.addWidget(stringAdresses)
stringAdresses.setInlineStyle(`
flex-direction:row;
`)

const firstStringAddressLineEdit = new QLineEdit();
const lastStringAddressLineEdit = new QLineEdit();
firstStringAddressLineEdit.setPlaceholderText("First string address")
firstStringAddressLineEdit.setToolTip("First string address in the file, for the section that you will translate (without 0x).")
lastStringAddressLineEdit.setPlaceholderText("Post-last string address")
lastStringAddressLineEdit.setToolTip("Post-last string address in the file, for the section that you will translate (without 0x).")


lastStringAddressLineEdit.setInlineStyle(`
width:118px;
font-size:11px;
`)

firstStringAddressLineEdit.setInlineStyle(`
width:119px;
font-size:11px;
`)

stringAdressesLayout.addWidget(firstStringAddressLineEdit)
stringAdressesLayout.addWidget(lastStringAddressLineEdit)

//RWA:File path--------------------------------------------------------
const filePath = new QWidget();
const filePathLayout = new FlexLayout();
filePath.setLayout(filePathLayout)
rightWidgetLayout.addWidget(filePath)
filePath.setInlineStyle(`
flex-direction:column;
`)

const filePathTitle = new QLabel()
const filePathQLineEditRead = new QLineEdit()
filePathQLineEditRead.setReadOnly("true")
filePathTitle.setText("File path *")
filePathTitle.setAlignment(132)

filePathQLineEditRead.setText("N/A")


filePathTitle.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

filePathQLineEditRead.setInlineStyle(`
color:blue;
font-size:12px;
`)

filePathLayout.addWidget(filePathTitle)
filePathLayout.addWidget(filePathQLineEditRead)

//RWA:Pointers Viewer--------------------------------------------------------
const pointersViewerTitle = new QWidget();
const pointersViewerTitleLayout = new FlexLayout();
pointersViewerTitle.setLayout(pointersViewerTitleLayout)
rightWidgetLayout.addWidget(pointersViewerTitle)


const pointersViewerTitleLabel = new QLabel()
pointersViewerTitleLabel.setText(`Pointers Viewer (Total) (Shared)`)
pointersViewerTitleLabel.setAlignment(4)
pointersViewerTitleLabel.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

pointersViewerTitleLayout.addWidget(pointersViewerTitleLabel)

const pointersViewer = new QWidget();
const pointersViewerLayout = new FlexLayout();
pointersViewer.setLayout(pointersViewerLayout)
rightWidgetLayout.addWidget(pointersViewer)
pointersViewer.setInlineStyle(`
flex-direction:row;
border-style:solid;
border-width:3px;
`)

const pointersViewerLeft = new QWidget();
const pointersViewerLeftLayout= new FlexLayout()
const pointersViewerRight = new QWidget();
const pointersViewerRightLayout= new FlexLayout()
pointersViewerLeft.setLayout(pointersViewerLeftLayout)
pointersViewerRight.setLayout(pointersViewerRightLayout)

pointersViewerLayout.addWidget(pointersViewerLeft)
pointersViewerLayout.addWidget(pointersViewerRight)

pointersViewerRight.setInlineStyle(`
flex:1;
`)

const pointersViewerlistWidget = new QListWidget()
const pointersViewerlistWidgetLayout = new QBoxLayout(1);

pointersViewerlistWidget.setLayout(pointersViewerlistWidgetLayout)
pointersViewerlistWidget.setInlineStyle(`
height:150px;
border-style:solid;
border-width:3px;
background-color:white;
`)

pointersViewerlistWidget.setSizePolicy(4,4)
const pointersViewerButtonToHide00 = new QCheckBox()
pointersViewerButtonToHide00.setEnabled(false)
pointersViewerButtonToHide00.setContentsMargins(0,0,0,0)
pointersViewerButtonToHide00.setText("Hide 0's of viewer")
pointersViewerLeftLayout.addWidget(pointersViewerButtonToHide00)

const pointersViewerForSharedPointersListWidget = new QListWidget()
pointersViewerForSharedPointersListWidget.setEnabled(false)
pointersViewerForSharedPointersListWidget.setInlineStyle(`
height:60px;
width:110px;
background-color:white;
`)
pointersViewerLeftLayout.addWidget(pointersViewerForSharedPointersListWidget)

const pointersEditor = new QLineEdit()
pointersEditor.setEnabled(false)

pointersEditor.setPlaceholderText("Pointer to edit")
pointersEditor.setInlineStyle(`
width:86px;`)

const pointersEditorLabel = new QLabel()
pointersEditorLabel.setEnabled(false)

pointersEditorLabel.setText("#n")
pointersEditorLabel.setAlignment(132)
const pointersEditorWidget = new QWidget()
pointersEditorWidget.setInlineStyle(`
flex-direction:row;`)
const pointersEditorLayout = new FlexLayout()
pointersEditorWidget.setLayout(pointersEditorLayout)
pointersEditorLayout.addWidget(pointersEditor)
pointersEditorLayout.addWidget(pointersEditorLabel)
pointersViewerLeftLayout.addWidget(pointersEditorWidget)

//When a item in the pointers viewer list widget is selected, the pointer(s) is set
//into the editor.
pointersViewerForSharedPointersListWidget.addEventListener("itemSelectionChanged",function(){

  pointersEditor.setText(`${pointersViewerForSharedPointersListWidget.currentItem().text()}`)
  pointersEditorLabel.setText(`#${pointersViewerForSharedPointersListWidget.currentRow()+1} `)

})

const pointersEditorSaveButton = new QPushButton()
pointersEditorSaveButton.setEnabled(false)

pointersEditorSaveButton.setText("Save changes")
pointersEditorSaveButton.setToolTip("Save the current changes made to the pointer.")
pointersViewerLeftLayout.addWidget(pointersEditorSaveButton)

pointersEditorSaveButton.addEventListener("clicked",saveEditedPointer)


const pointersEditorRealocateButton = new QPushButton()
pointersEditorRealocateButton.setEnabled(false)

pointersEditorRealocateButton.setText("Move to new string")
pointersEditorRealocateButton.setToolTip("Relocate the selected pointer to a new string (If there are space to do it) and save.")
pointersViewerLeftLayout.addWidget(pointersEditorRealocateButton)

//Change the values of a pointer to make it match with a new empty string
pointersEditorRealocateButton.addEventListener("clicked",function(){
  relocateToNewString()
  saveAndPrepare()
  listWidget.scrollToBottom()
})

pointersViewerRightLayout.addWidget(pointersViewerlistWidget)
pointersViewerButtonToHide00.addEventListener("clicked",function(){
  hideShow()
})


//When a item in the pointers viewer is selected,
//this add a Widget right above of it, the widget
//has exactly the same values of the pointer but with red
//color (if is the first) or blue (for the rest). Also add a enumeration
//to the pointers viewer and the shared pointers viewer.
pointersViewerlistWidget.addEventListener("itemSelectionChanged",function (){

  let i =0;
  let k = 0;
  let phase = 0
  let counter =1
  sharedPointers=1

  pointersViewerForSharedPointersListWidget.clear()
  pointersEditor.clear()
  pointersEditorLabel.setText("#n")

  while(extractedPointersIn4[i] != undefined){
    
    if(extractedPointersIn4[i].toString("hex").toUpperCase() === pointersViewerlistWidget.currentItem().text().toUpperCase() && phase===0){
      

      pointerAddressLabel.setText(`Pointer Address: ${addressOfEachPointer[i].toString(16).toUpperCase()}`)



      
      if(oldSelectedString != -1){

        pointersViewerlistWidget.removeItemWidget(pointersViewerlistWidget.item(oldSelectedString))
        
        while(oldMatchedSharedPointers[k]!=undefined){
          pointersViewerlistWidget.removeItemWidget(pointersViewerlistWidget.item(oldMatchedSharedPointers[k]))
          k=k+1;
        }
        oldMatchedSharedPointers=[]
        k=0;
      }
      if(pointersViewerlistWidget.currentItem().text() ==="00000000"||pointersViewerlistWidget.currentRow() ===0){
        break
      }

      let pointerViewerListQWidget = new QWidget()
      let pointerViewerListQWidgetLayout = new FlexLayout
      pointerViewerListQWidget.setLayout(pointerViewerListQWidgetLayout)
      let pointerViewerListQWidgetText = new QLabel
      pointerViewerListQWidgetText.setText(`${pointersViewerlistWidget.item(i).text()}` + ` ${counter}`)
      pointerViewerListQWidgetText.setInlineStyle(`
      color:red;
      margin: 0 1 0 0;
      `)
      pointerViewerListQWidgetLayout.addWidget(pointerViewerListQWidgetText)
      pointersViewerlistWidget.setItemWidget(pointersViewerlistWidget.item(i),pointerViewerListQWidget)
      
      phase=1;
      oldSelectedString = i;
      
      const tempItem = new QListWidgetItem()
      tempItem.setText(pointersViewerlistWidget.item(i).text())
      pointersViewerForSharedPointersListWidget.addItem(tempItem)
      
      let pointerViewerListQWidget2 = new QWidget()
      let pointerViewerListQWidgetLayout2 = new FlexLayout
      pointerViewerListQWidget2.setLayout(pointerViewerListQWidgetLayout2)
      let pointerViewerListQWidgetText2 = new QLabel
      pointerViewerListQWidgetText2.setText(`${counter}`)
      pointerViewerListQWidgetText2.setInlineStyle(`
      color:red;
      margin-left:30px;
      `)
      pointerViewerListQWidgetLayout2.addWidget(pointerViewerListQWidgetText2)
      pointersViewerForSharedPointersListWidget.setItemWidget(pointersViewerForSharedPointersListWidget.item(0),pointerViewerListQWidget2)
      counter = counter+1;
      
    }else if(extractedPointersIn4[i].toString("hex").toUpperCase() === pointersViewerlistWidget.currentItem().text().toUpperCase() && phase===1){
      let pointerViewerListQWidget2 = new QWidget()
      let pointerViewerListQWidgetLayout2 = new FlexLayout
      pointerViewerListQWidget2.setLayout(pointerViewerListQWidgetLayout2)
      let pointerViewerListQWidgetText2 = new QLabel
      pointerViewerListQWidgetText2.setText(`${pointersViewerlistWidget.item(i).text()}` + `  ${counter}`)
      pointerViewerListQWidgetText2.setInlineStyle(`
      color:midnightblue;
      margin: 0 1 0 0;
      `)
      pointerViewerListQWidgetLayout2.addWidget(pointerViewerListQWidgetText2)
      pointersViewerlistWidget.setItemWidget(pointersViewerlistWidget.item(i),pointerViewerListQWidget2)
      sharedPointers=sharedPointers+1;
      oldMatchedSharedPointers[k]= i
      
      const tempItem = new QListWidgetItem()
      tempItem.setText(pointersViewerlistWidget.item(i).text())
      pointersViewerForSharedPointersListWidget.addItem(tempItem)
      
      let pointerViewerListQWidget3 = new QWidget()
      let pointerViewerListQWidgetLayout3 = new FlexLayout
      pointerViewerListQWidget3.setLayout(pointerViewerListQWidgetLayout3)
      let pointerViewerListQWidgetText3 = new QLabel
      pointerViewerListQWidgetText3.setText(`${counter}`)
      pointerViewerListQWidgetText3.setInlineStyle(`
      color:black;
      margin-left:30px;
      `)
      pointerViewerListQWidgetLayout3.addWidget(pointerViewerListQWidgetText3)
      pointersViewerForSharedPointersListWidget.setItemWidget(pointersViewerForSharedPointersListWidget.item(k+1),pointerViewerListQWidget3)
      
      counter = counter+1;
      k=k+1
    }
    i=i+1;
  }
  oldMatchedSharedPointers.unshift(pointersViewerlistWidget.currentRow())

  pointersViewerTitleLabel.setText(`Pointers Viewer (${extractedPointersIn4.length-hiddenPointers}) (${sharedPointers})`)

})

//RWA:Save settings button--------------------------------------------------
const saveSettings = new QWidget();
const saveSettingsLayout = new FlexLayout();
saveSettings.setInlineStyle(`
border-color:black;
border-style:solid;
border-top-width:1px;
`)
saveSettings.setLayout(saveSettingsLayout)
rightWidgetLayout.addWidget(saveSettings)

const saveSettingsButton = new QPushButton();
saveSettingsButton.setText("Save settings and start!")
saveSettingsButton.setToolTip("Saves the settings in settings.cfg and loads\ndata from the file selected previously.")
saveSettingsLayout.addWidget(saveSettingsButton)

const saveSettingsButton2 = new QPushButton();
saveSettingsButton2.setText("Save settings and start (no pointers)")
saveSettingsLayout.addWidget(saveSettingsButton2)

//RWA:CSV translation------------------------------------------
const csvTranslator = new QWidget();
const csvTranslatorLayout = new FlexLayout();
csvTranslator.setLayout(csvTranslatorLayout)
rightWidgetLayout.addWidget(csvTranslator)

const csvButton = new QPushButton();
csvButton.setText("Translate strings using a .csv")
csvTranslatorLayout.addWidget(csvButton)
csvButton.setToolTip("Use a .csv with semicolons to translate a group of strings. The \n.csv must contain two columns, the first must have translated strings\nand the second one is for the untranslated text. Each string\nmust be separated from another with at least one row of space and\nboth strings must start in the same row.\nMatch only the complete string.")
csvButton.addEventListener("clicked",function (){csvTranslation()})
csvButton.setEnabled(false)

const csvButton2 = new QPushButton();
csvButton2.setText("Translate strings partially using a .csv")
csvTranslatorLayout.addWidget(csvButton2)
csvButton2.setToolTip("Use a .csv with semicolons to translate a group of strings. The \n.csv must contain two columns, the first must have translated strings\nand the second one is for the untranslated text. Each string\nmust be separated from another with at least one row of space and\nboth strings must start in the same row.\nMatch words or phrases inside a string.")
csvButton2.addEventListener("clicked",function (){csvTranslation(1)})
csvButton2.setEnabled(false)

//RWA:Export all data to a CSV button------------------------------------------
const exportAllData = new QWidget();
const exportAllDataLayout = new FlexLayout();
exportAllData.setLayout(exportAllDataLayout)
rightWidgetLayout.addWidget(exportAllData)

const exportAllButton = new QPushButton();
exportAllButton.setText("Export all the data to a .csv")
exportAllDataLayout.addWidget(exportAllButton)
exportAllButton.setToolTip("Export all the data found in the file into a comfy .csv\nData sorting is up to you.")
exportAllButton.addEventListener("clicked",function() {exportAllSelection()})
exportAllButton.setEnabled(false)

//RWA: MHG Wii Pointer Button--------------------------------------------
const bigEndian = new QCheckBox()
bigEndian.setText("Big Endian (MHTri/G on Wii)")
bigEndian.setToolTip("Changes the pointers used to Big Endian.")


const bottomRightSquare = new QWidget()
const bottomRightSquareLayout = new FlexLayout()
bottomRightSquare.setLayout(bottomRightSquareLayout)
rightWidgetLayout.addWidget(bottomRightSquare)

bottomRightSquareLayout.addWidget(bigEndian)

bottomRightSquare.setInlineStyle(`
flex-direction:row;
`)
//RWA: Fast Button--------------------------------------------
const fastButton = new QCheckBox();

fastButton.setText("Fast")
fastButton.setToolTip("Do not display a pop-up when .csv translation found a match.\nIf there are a lot of strings to be translated don't enable this option.")
fastButton.setEnabled(true)
bottomRightSquareLayout.addWidget(fastButton)

fastButton.setInlineStyle(`
margin-left:1px;
`)
bottomRightSquare.setInlineStyle(`
border-color:black;
border-style:solid;
border-top-width:1px;
`)

//The QTextCursor is neccesary to make this part work since i need to move the cursor to
//the end of the text but that module has not been ported to nodegui yet :/ . This will
//remain commented.
//RWA: String editor auto-------------------------------------------------------
const autoCharaAdjust = new QCheckBox()
autoCharaAdjust.setText("String editor auto-adjust")

// autoCharaAdjust.setToolTip("Adjust automatically the string editor")
// rightWidgetLayout.addWidget(autoCharaAdjust)
autoCharaAdjust.setEnabled(false)
// autoCharaAdjust.addEventListener("stateChanged",function (){
//   if(autoCharaAdjust.isChecked() ===true){
//     stringEditorTextEdit.addEventListener("textChanged",function (){
//       specificCharactersPerLine(0)
//     })
//   }else{
//     stringEditorTextEdit.removeEventListener("textChanged")
//   }
// })

//Coding stuff------------------------------------------------------------------
// const qApp = QApplication.instance()
// qApp.setStyleSheet(`
// * {
// font-family:Segoe UI;
// }
// `)

const fileDialog = new QFileDialog();
let errorMessageBox = new QMessageBox()
let errorMessageButton = new QPushButton()
errorMessageButton.setInlineStyle(`

`)
errorMessageBox.addButton(errorMessageButton)

fileDialog.setFileMode(0)

mainMenuAction1.addEventListener('triggered', function () {
  
  if(pointersTableMode===true){
    removePointersTable()
  }else{
    loadFile()
  }

})

mainMenuAction6.addEventListener('triggered', function (){
  let exit = new QApplication()
  exit.exit(0)
})
saveSettingsButton.addEventListener("clicked",saveAndPrepare)
saveSettingsButton2.addEventListener("clicked",function (){saveAndPrepare2()})


//If settings.cfg exist, this will get all it info.
if( fs.existsSync(`./settings.cfg`) === false){

fs.writeFile(`./settings.cfg`,`${Buffer.from("310d0a0d0a0d0a0d0a0d0a0d0a5b53504c49545d0d0a32", "hex")}`,
(err) => {
  if (err){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("ERROR! settings.cfg could not be created D:\n")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    
  }
  else {
    console.log("settings.cfg created successfully\n");
  }
})

}else if(fs.existsSync(`./settings.cfg`) === true){

  console.log("settings.cfg loaded successfully\n");
  let projectsConfBuff =fs.readFileSync(`./settings.cfg`).toString("hex")

  if(projectsConfBuff.includes("5b53504c49545d0d0a") === true){

    projectsConfHexArr = projectsConfBuff.split("5b53504c49545d0d0a")


  }else{
    projectsConfHexArr = [projectsConfBuff]
  }

  if(
  (projectsConfHexArr[0].split("0d0a")[0]) === '' ||
  (projectsConfHexArr[0].split("0d0a")[1]) === '' ||
  (projectsConfHexArr[0].split("0d0a")[2]) === '' ||
  (projectsConfHexArr[0].split("0d0a")[3]) === '' ||
  (projectsConfHexArr[0].split("0d0a")[4]) === '' ||
  (projectsConfHexArr[0].split("0d0a")[5]) === '' ||
  (projectsConfHexArr[0].split("0d0a")[6]) === '' ){

    console.log("Not valid data :/, hex spaces will be empty")

  }else{
    console.log("Valid data.")
    sectionNameNumber.setText(Buffer.from(projectsConfHexArr[0].split("0d0a")[0], "hex").toString("utf8") + " ")
    
    if(projectsConfHexArr[0].split("0d0a")[1] === "2a"){

    }else{
      sectionNameLineEdit.setText(Buffer.from(projectsConfHexArr[0].split("0d0a")[1], "hex").toString("utf8"))
    }

    if(projectsConfHexArr[0].split("0d0a")[2] === "2a"){

    }else{
      firstPointerAddressLineEdit.setText(Buffer.from(projectsConfHexArr[0].split("0d0a")[2], "hex").toString("utf8"))
    }

    if(projectsConfHexArr[0].split("0d0a")[3] === "2a"){

    }else{
      lastPointerAddressLineEdit.setText(Buffer.from(projectsConfHexArr[0].split("0d0a")[3], "hex").toString("utf8"))
    }

    firstStringAddressLineEdit.setText(Buffer.from(projectsConfHexArr[0].split("0d0a")[4], "hex").toString("utf8"))
    lastStringAddressLineEdit.setText(Buffer.from(projectsConfHexArr[0].split("0d0a")[5], "hex").toString("utf8"))
    filePathQLineEditRead.setText(Buffer.from(projectsConfHexArr[0].split("0d0a")[6], "hex").toString("utf8"))
    selectedFile = [`${`${Buffer.from(projectsConfHexArr[0].split("0d0a")[6], "hex").toString("utf8")}`}`]
    start()
  }
}

//CS:Drag and drop configurations---------------------------
win.setAcceptDrops(true);

win.addEventListener(WidgetEventTypes.DragEnter, (e) => {
    let ev = new QDragMoveEvent(e);
    ev.accept(); //Accept the drop event, which is crucial for accepting further events
});

//Get the path of any file dropped into the tool window
win.addEventListener(WidgetEventTypes.Drop, (e) => {

  if(pointersTableMode===true){

  }else{
    let dropEvent = new QDropEvent(e);
    let mimeData = dropEvent.mimeData();
    let urls = mimeData.urls();
    for (let url of urls) {
      selectedFile = url.toString().replace("file:///","");
      start()
    }
  }
});

//CS:Show window------------------------------------------
win.setCentralWidget(rootView);
win.show();

global.win = win;