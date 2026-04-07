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
  QDialog,
  QIcon,
  QButtonGroup,
  QRadioButton,
  QProgressDialog,

} = require("@nodegui/nodegui");

const {
  hexView,
  currentEncoding,
  hexViewBuffer,
  setUTF8EncodingAndRender,
  setShiftJISEncodingAndRender,
  shutdownHexView,toHexadecimal
} = require("./hexView.js")

const Os = require ('os')
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
let firstStringOffsetInDecimal= ""
let lastStringOffsetInDecimal = ""
let firstPointerOffsetInDecimal= ""
let lastPointerOffsetInDecimal = ""
let extractedStringsOLD = ""
let spaceLeftInSection = 0
let offsetOfEachString = []
let offsetOfEachPointer = []
let pointersHexValues = []
let addressOfEachStringInMemory= []
let extractedPointersIn4= []
let extractedPointersIn4Non0= []
let extractedPointers = ""
let oldPointersHexValues = []
let savedString = ""
let oldRawString = ""
let oldSelectedString = -1
let quantityOfSharedPointers = 0
let itemPositionOfSharedPointers = []
let sectionNameHeader= "Section name"
let hiddenPointers = 0
let selectedTablePointers = []
let extractedTablePointersRaw = []
let extractedTablePointersIn4 = []
let extractedTablePointersIn4Non0 = []
let tableStartPointerFileOffsets = []
let tableEndPointerStartStringFileOffsets = []
let tableEndStringFileOffsets = []
let sectionedCurrentContent = []
let selectedPTFile = ""
let pointersTableModeON = false
let csvTranslationMode = false
let csvInfoGatheringMode = false
let sectionPaginationPointerFlag = 0
let pointersTableModeSettingsArr = []
let currentTableContent = []
let organizedSections = []
let oldSelectedTablePointers = []
let stringsOffset = 0
let shiftJISEncoding = false
let UTF8Encoding = true
let originalExtractedStringsLength = 0
let globalOffset = 0
let stopCsvInfoGatheringMode = false
let notCorrectDataSkipThisSection = false
let postLastStringOffset
let globalExtractedStrings = []
let globalOffsetOfEachString = []
let oldcurrentContentLength
let timer
let csvTranslationCanceled = false
const mibListObjsData = []
let sectionChangeInProcess = false
let initPointersTableMode = false
let tableModeMasterDataObj
let oldTableModeMasterDataObj
let totalDeletedBytes
let sectionedCurrentContentLength = 0
//let tablePointersIndexPositions

//Take the text on the "Search..." square and use it to find matches, then saves the position of matched strings in matchSearch.
function saveItemsInArr(textToSearch){
  matchSearch = []
  let i = 0
  if (textToSearch != ""){
    for(i = 0;i<listWidget.count();++i){
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

      if(firstPointerOffsetInDecimal!= ""){
        stringOffsetLabel.setText(`String Offset: ${offsetOfEachString[listWidget.currentRow()]}`+"/"+ "0x" + `${addressOfEachStringInMemory[listWidget.currentRow()].toString(16).toUpperCase().replaceAll("00","")}`)

      }else{
        stringOffsetLabel.setText(`String Offset: ${offsetOfEachString[listWidget.currentRow()]}`)
      }

      if(firstPointerOffsetInDecimal!= ""){
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
  const currentPath = filePathQLineEditRead.text()?filePathQLineEditRead.text():""
  const chooseFileDialog = new QFileDialog(win,undefined,currentPath);
  chooseFileDialog.setFileMode(0)

  let goBack = true
    
  chooseFileDialog.addEventListener("fileSelected",function(file){
    if(chooseFileDialog.selectedFiles().length!=0&&
    fs.lstatSync(file).isDirectory()===false){

      selectedFile = file
      start()
      goBack = false
    }else{
      selectedFile = filePathQLineEditRead.text()
      start()
      return
    }
    const encoding = UTF8Encoding?"UTF8":"SJIS"
    hexView(selectedFile,encoding)
  })

  chooseFileDialog.exec();

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

  if(pointersTableModeON===true){
    mainMenuAction3.setEnabled(false)
  }
}

//Uses only 1-6 Hex characters with a usable offset.
//Makes visible all the hidden options and then uses the given offsets by the user to
//get the pointers (extractedPointers), add them as items in the pointers viewer and save them for later, 
//then does the same for the text in the file (extractedStrings), add those to the listWidget and also
//transform the encoded text to UTF8. Additionally saves a copy of extractedStrings to use it as reference to know
//the amount of space that never must be surpassed.
function saveAndPrepare(doASave) {

  if (!validateHexOffsets() || !fs.existsSync(selectedFile)) {
    handleValidationError();
    return;
  }

  firstPointerOffsetInDecimal = parseInt(firstPointerOffsetLineEdit.text(), 16);
  lastPointerOffsetInDecimal = parseInt(lastPointerOffsetLineEdit.text(), 16);

  if (!validatePointerOffsets()) return;

  firstStringOffsetInDecimal = parseInt(firstStringOffsetLineEdit.text(), 16)
  lastStringOffsetInDecimal = parseInt(lastStringOffsetLineEdit.text(), 16)

  if (!validateStringOffsets()) return;

  setDefaultValues(1);
  enablePointerControls(true);

  processPointers();

  processStrings();
  
  executeFinalFunctions(doASave);
  listWidget.setCurrentRow(0)
}

//Similar to saveAndPrepare but only is used when no pointers are given
function saveAndPreparePointerless(doASave) {
  if (!validateHexOffsets(false) || !fs.existsSync(selectedFile)) {
    handleValidationError();
    return;
  }

  firstStringOffsetInDecimal = parseInt(firstStringOffsetLineEdit.text(), 16)
  lastStringOffsetInDecimal = parseInt(lastStringOffsetLineEdit.text(), 16)

  if (!validateStringOffsets()) return;

  setDefaultValues(2);
  enablePointerControls(false);

  processStrings();

  executeFinalFunctions(doASave, true);
}

//Handles validation error message
function handleValidationError(checkPointers = true) {
  const errorMessage = checkPointers ? 
    "Not correct hex format or invalid file path, aborting..." :
    "Not correct hex format for strings or invalid file path, aborting...";
  if (csvInfoGatheringMode === false) {
    errorMessageBox.setWindowTitle("Error");
    errorMessageBox.setText(errorMessage);
    errorMessageButton.setText("OK".padStart(40).padEnd(40));
    errorMessageBox.exec();
  } else {
    console.log("Not valid configuration, skipping...");
    notCorrectDataSkipThisSection = true;
  }
}

//Check if the hex format is correct with regex
function validateHexOffsets(checkPointers = true) {
  const hexRegex = /^[0-9A-F]{1,6}$/i;
  const validations = [
    firstStringOffsetLineEdit.text().match(hexRegex),
    lastStringOffsetLineEdit.text().match(hexRegex),
    checkPointers ? firstPointerOffsetLineEdit.text().match(hexRegex) : true,
    checkPointers ? lastPointerOffsetLineEdit.text().match(hexRegex) : true
  ];
  return validations.every(Boolean);
}

//Check if the pointer offsets are ok
function validatePointerOffsets() {
  if (firstPointerOffsetInDecimal > currentContent.length || 
    lastPointerOffsetInDecimal > currentContent.length) {
    return handleOffsetsError("At least one pointer offset is too big for this file x_x");
  }
  if (lastPointerOffsetInDecimal <= firstPointerOffsetInDecimal) {
    const msg = lastPointerOffsetInDecimal === firstPointerOffsetInDecimal ?
      "Invalid pointer offsets, same offsets" :
      "Invalid pointers scheme, the last pointer offset\nis greater than the first one";
    return handleOffsetsError(msg);
  }
  return true;
}

//Check if the string offsets are ok
function validateStringOffsets() {
  if (firstStringOffsetInDecimal > currentContent.length || 
    lastStringOffsetInDecimal > currentContent.length) {
    return handleOffsetsError("At least one string offset is too big for this file x_x");
  }
  if (lastStringOffsetInDecimal <= firstStringOffsetInDecimal) {
    const msg = lastStringOffsetInDecimal === firstStringOffsetInDecimal ?
      "Invalid string offsets, same offsets" :
      "Invalid string scheme, the last string offset\nis greater than the first one";
    return handleOffsetsError(msg);
  }
  return true;
}

//Handles validation error when offset is not correct
function handleOffsetsError(message) {
  if (csvInfoGatheringMode === false) {
    errorMessageBox.setWindowTitle("Error");
    errorMessageBox.setText(message);
    errorMessageButton.setText("OK".padStart(40).padEnd(40));
    errorMessageBox.exec();
  } else {
    console.log("Not valid configuration, skipping...");
    notCorrectDataSkipThisSection = true;
  }
  return false;
}

// Get pointers using the given offsets, separate them into groups of 4 bytes, and add them to the viewer
function processPointers() {
  extractedPointers = currentContent.slice(firstPointerOffsetInDecimal, lastPointerOffsetInDecimal);
  pointersViewerFull.clear();
  hiddenPointers = 0;
  let nonZeroIndex = 0;

  for (let i = 0; extractedPointers.length > 1; i++) {
    const pointerSlice = extractedPointers.slice(0, 4);
    extractedPointersIn4[i] = pointerSlice;

    if (pointerSlice.toString("hex") !== "00000000") {
      extractedPointersIn4Non0[nonZeroIndex++] = pointerSlice;
    }

    const item = new QListWidgetItem(pointerSlice.toString("hex").toUpperCase());
    pointersViewerFull.addItem(item);

    if (item.text() === "00000000" && pointersViewerButtonToHide00.isChecked()) {
      item.setHidden(true);
      hiddenPointers++;
    }

    extractedPointers = extractedPointers.slice(4);
  }

  pointersViewerTitleLabel.setText(`Pointers Viewer (${extractedPointersIn4.length-hiddenPointers}) (${quantityOfSharedPointers})`);
}

//Extracts null-terminated strings between the specified offsets,
//parses them (handling consecutive nulls), converts encoding if needed,
//and displays them in the string list widget.
function processStrings() {
  extractedStrings = currentContent.slice(firstStringOffsetInDecimal, lastStringOffsetInDecimal);
  let tempStrings = extractedStrings;
  rawStrings = [];
  let i = 0;

  while (tempStrings.length > 0) {
    let k = 0;
    while (k < tempStrings.length && tempStrings[k] !== 0) {
      k++;
    }

    //Find the next non 00 byte after the first one
    let nextNonZero = k;
    while (nextNonZero < tempStrings.length && tempStrings[nextNonZero] === 0) {
      nextNonZero++;
    }

    if (nextNonZero < tempStrings.length) {
      rawStrings[i++] = tempStrings.slice(0, nextNonZero);
      tempStrings = tempStrings.slice(nextNonZero);
    } else {
      rawStrings[i++] = tempStrings;
      break;
    }
  }

  //Clear and update the string list
  listWidget.clear();
  for (let j = 0; j < rawStrings.length; j++) {
    const text = shiftJISEncoding ? 
      EncodingModule.codeToString(EncodingModule.convert(rawStrings[j], {to: 'UNICODE', from: 'SJIS'})) :
      rawStrings[j].toString();
    
    listWidget.addItem(new QListWidgetItem(text));
  }
  extractedStringsOLD = Buffer.concat(rawStrings);
  originalExtractedStringsLength = extractedStringsOLD.length;
}

//Executes final processing functions based on pointer presence.
//Handles both pointer and pointerless paths, calculates remaining space,
//and either updates pointer table or saves configuration.
function executeFinalFunctions(doASave, isPointerless = false) {
  if(!isPointerless) {
    stringOffsetFunc(currentContent);
    pointerOffsetFunc();
    hexValuesFunc();
    pointerAdjuster(currentContent);
  }else{
    stringOffsetFuncWithoutPointers(currentContent, firstStringOffsetInDecimal, lastStringOffsetInDecimal);
  }
  
  spaceLeftFunc(extractedStrings);
  
  if(pointersTableModeON){
    if (!initPointersTableMode&&!sectionChangeInProcess) pointersTableUpdater();
  }else if(doASave){
    saveConfiguration();
  }

  if(initPointersTableMode) initPointersTableMode = false

  if(sectionChangeInProcess) sectionChangeInProcess = false
}

//Enables (or not) pointers to be edited
function enablePointerControls(enable) {
  csvButton.setEnabled(true);
  csvButton2.setEnabled(true);
  exportAllButton.setEnabled(true);
  bigEndian.setEnabled(false);

  pointersViewerButtonToHide00.setEnabled(enable);
  pointersEditorRealocateButton.setEnabled(enable);
  pointersEditorSaveButton.setEnabled(enable);
  pointersEditorLabel.setEnabled(enable);
  pointersEditor.setEnabled(enable);
  pointersViewerSpecific.setEnabled(enable);
}

//Gather all the info to know the offset of each string in the file and their address in the memory 
//(the memory one is accurate only if the console uses pointers based in the total lenght of data in the RAM)
//data = currentContent, basically, the file.
function stringOffsetFunc(data){

  let i = firstStringOffsetInDecimal;
  let phase = 0;
  let k = 0;
  let firstLetterFound= false
  //Analyze all the string indexes from currentContent
  //Saves the address/string index of each string start

  if(data[i]!=0){
    phase = 1;
    firstLetterFound= true
  }
  lastStringOffsetInDecimal = fileSizeMenuAction2NoKeepSize.isChecked()?
  parseInt(lastStringOffsetLineEdit.text(), 16)+extractedStrings.length-originalExtractedStringsLength:
  parseInt(lastStringOffsetLineEdit.text(), 16)
  lastStringOffsetLineEdit.setText(lastStringOffsetInDecimal.toString(16).toUpperCase())
  
  const parseEnd = lastStringOffsetInDecimal

  while(i != parseEnd){
    
    if(data[i] != 0 && phase === 1){

      offsetOfEachString[k] = i.toString(16).toUpperCase();
      k=k+1;
      phase= 2;
      
    }else if(data[i] === 0 && phase===2){

      phase = 1
    }else if(data[i]===0&& phase === 0 &&pointersTableModeON===true){

      offsetOfEachString[k] = i.toString(16).toUpperCase();
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

  let firstPointerW = pointersViewerFull.item(0).text()

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

  while(offsetOfEachString[i] != undefined){
  

    let differenceInDecimals = parseInt(offsetOfEachString[i],16)-parseInt(offsetOfEachString[0],16)
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

//Reverses the byte order of a hex string (e.g., "AABBCC" -> "CCBBAA")
function reverseHex(hex) {
  return hex.match(/.{1,2}/g).reverse().join('');
}

//Pads a hex string to specified length, then reverses byte order
function padAndReverseHex(hex, length) {
  return hex.padStart(length, '0').match(/.{1,2}/g).reverse().join('');
}

// Checks if a hex string has leading zeros (left) or trailing zeros (right)
function getPaddingInfo(hex) {
  let left = false, right = false;
  for (let i = 0, j = hex.length - 1; i <= j; i++, j--) {
    if (hex[i] === '0') left = true;
    if (hex[j] === '0') right = true;
  }
  return { left, right };
}

// Applies padding to left or right based on padding info, or returns unchanged
function applyPadding(hex, targetLen, { left, right }) {
  if (left && !right) return hex.padStart(targetLen, '0');
  if (!left && right) return hex.padEnd(targetLen, '0');
  return hex;
}

//Similar to stringOffsetFunc()
function stringOffsetFuncWithoutPointers(data,start,end){
  
  let i = start;

  let phase = 0;
  let k = 0;
  offsetOfEachString = []

  //Analyze all the string indexes from currentContent
  //Saves the offset/string index of each string start
  while(i != end){

    if(data[i] != 0 && phase === 0){

      offsetOfEachString[k] = i.toString(16).toUpperCase();
      k=k+1;
      phase= 1;
      
    }else if(data[i] === 0 && phase===1){

      phase = 0
    }
    i=i+1;
  }
  return offsetOfEachString
}

//Determines all the space left that can be edited by analyzing the amount of 00 that 
//are in the specified section of the file, or the entire file if is a pointers table.
function spaceLeftFunc(extractedStringsData){
  spaceLeftInSection = 0
  let i = 0

  while(extractedStringsData[i] != undefined){
    if(extractedStringsData[i] === 0&&extractedStringsData[i+1] === 0){
      spaceLeftInSection= spaceLeftInSection+1
    }
    i=i+1
  }

  if(!pointersTableModeON){
    spaceLeftLabel.setText(`Space left: ${spaceLeftInSection}`)
    return
  }

  let globalSpaceLeftInSection = 0
  for(i=0;globalExtractedStrings[i];i++){
    const currentSectionIndex = Number(sectionNameNumber.text())-1
    if(i===currentSectionIndex) continue
    
    let k = 0;
    
    while(globalExtractedStrings[i][k] != undefined){
      if(globalExtractedStrings[i][k] === 0&&globalExtractedStrings[i][k+1]===0){
        globalSpaceLeftInSection= globalSpaceLeftInSection+1
      }
      k=k+1;
    }
  }
  spaceLeftLabel.setText(`Space left in section: ${spaceLeftInSection} (Global ${spaceLeftInSection+globalSpaceLeftInSection})`)
}

//Saves the offset of each pointer to be used later.
function pointerOffsetFunc(){

  let i = firstPointerOffsetInDecimal;
  let k = 0;

  while(i < lastPointerOffsetInDecimal){

    offsetOfEachPointer[k]= i
    k=k+1
    i=i+4;
  }
}

//Determines the pointers that must be edited by comparing the new ones with the old ones.
function hexValuesFunc() {
  let i = 1;
  let phase = 0;
  const marker = Buffer.from("5B506F743474305D", "hex"); // [POT4T0]

  //Comparison and update of pointers
  while (oldPointersHexValues[i] !== undefined) {
    if (pointersHexValues[i] !== oldPointersHexValues[i]) {
      const oldPtrRaw = Buffer.from(oldPointersHexValues[i], "hex");
      const newPtrRaw = Buffer.from(pointersHexValues[i], "hex");
      const combinedPtr = Buffer.concat([newPtrRaw, marker]);

      for (let s = 0; extractedPointersIn4[s] !== undefined; s++) {
        if (Buffer.compare(extractedPointersIn4[s], oldPtrRaw) === 0) {
          extractedPointersIn4[s] = Buffer.from(combinedPtr);
          phase = 1;
        }
      }
    }
    i++;
  }

  //Delete [POT4T0]
  i = 0;
  const markerStr = "5B506F743474305D";
  while (extractedPointersIn4[i] !== undefined) {
    const ptrHex = extractedPointersIn4[i].toString("hex").toUpperCase();
    if (ptrHex.includes(markerStr)) {
      extractedPointersIn4[i] = Buffer.from(ptrHex.replace(markerStr, ""), "hex");
    }
    i++;
  }

  pointersViewerTitleLabel.setText(`Pointers Viewer (${extractedPointersIn4.length-hiddenPointers}) (${quantityOfSharedPointers})`);
}

//Updates currentContent and pointers viewer list widget with the new pointer values.
function pointerAdjuster(data){
  let i = 0;

  extractedPointers = Buffer.concat(extractedPointersIn4);

  currentContent = Buffer.concat([
      data.subarray(0, firstPointerOffsetInDecimal),
      extractedPointers,
      data.subarray(lastPointerOffsetInDecimal)
  ]);

  i = 0;
  while(extractedPointersIn4[i] != undefined){
    if(pointersViewerFull.item(i).text() !=extractedPointersIn4[i].toString("hex").toUpperCase()){

      pointersViewerFull.item(i).setText(`${extractedPointersIn4[i].toString("hex").toUpperCase()}`)  
    }

    i=i+1;
  }
}

//Save your progress when edit a string.
//Before make the saves does some modifications to add or remove data to ensure that the defined
//area of strings that will be edited don't be bigger or lesser than the original one on the original file.
function saveProgress(isCSVTranslation,replacement){
  if(isCSVTranslation){

  }else if(listWidget.currentRow() === -1||stringEditorTextEdit.toPlainText()===""){
    return
  }
  let currentItemBackup
  if(isCSVTranslation){

    savedString = replacement
    listWidget.currentItem().setText(savedString.toString("utf8"))
    
  }else{
    currentItemBackup = listWidget.currentItem().text()
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

  if(firstPointerOffsetInDecimal=== ""){
    while(rawStrings[listWidget.currentRow()].length>savedString.length){

      savedString = Buffer.concat([savedString,newBuffer])
    }
    oldRawString =  rawStrings[listWidget.currentRow()]
  }

  rawStrings[listWidget.currentRow()] = savedString
  extractedStrings = Buffer.concat(rawStrings)

  const end = parseInt(lastStringOffsetLineEdit.text(), 16);

  if(extractedStrings.length>extractedStringsOLD.length&&
    pointersTableModeON===true&&
    fileSizeMenuAction1.isChecked()){

    let countHowMany00 = 0
    let i = end
    while(currentContent[i-1]===0){
      countHowMany00++
      i--
    }
    i = 0
    let bytesToDelete = extractedStrings.length-extractedStringsOLD.length
    while(countHowMany00>1&&bytesToDelete>0){
      const lastRawString = rawStrings.length-1
      rawStrings[lastRawString] = rawStrings[lastRawString].subarray(0,rawStrings[lastRawString].length-i-1)
      bytesToDelete--
      countHowMany00--
    }
    //if(countHowMany00>2){    }
    extractedStrings = Buffer.concat(rawStrings)

    extractedStringsOLD = Buffer.concat(rawStrings)
  }


  if(firstPointerOffsetInDecimal=== ""){
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
  }else if(!pointersTableModeON&&
    extractedStrings.length>originalExtractedStringsLength){
    
    let bytesToDelete = extractedStrings.length-extractedStringsOLD.length
    let i = rawStrings.length-1
    while(bytesToDelete>0&&spaceLeftInSection>0&&rawStrings[i]){
      let k = rawStrings[i].length-1

      while(k>1&&bytesToDelete>0&&spaceLeftInSection>0){
        if(rawStrings[i][k]===0&&rawStrings[i][k-1]===0){
          rawStrings[i] = rawStrings[i].subarray(0,k)
          bytesToDelete--
          spaceLeftInSection--
          k--
        }else{
          break
        }
      }
      i--
    }
    i = rawStrings.length-1
    while(bytesToDelete>0){
      let k = rawStrings[i].length-1
      while(k>1&&bytesToDelete>0){
        if(rawStrings[i][k]===0&&rawStrings[i][k-1]!==0&&rawStrings[i][k-2]!==0){
          rawStrings[i] = Buffer.concat([rawStrings[i].subarray(0,k-1),newBuffer])
          bytesToDelete--
          k--
        }else{
          break
        }
      }
      listWidget.item(i).setText(rawStrings[i].toString("utf8"))
      i--
    }
    extractedStrings = Buffer.concat(rawStrings)
  }

  while(extractedStrings.length<extractedStringsOLD.length){

    extractedStrings = Buffer.concat([extractedStrings,newBuffer])
    // console.log("Adding 00 to extractedStrings" + ` ${String(extractedStrings.length-extractedStringsOLD.length)}`)
  }

  const start = firstStringOffsetInDecimal;

  oldcurrentContentLength = currentContent.length;

  currentContent = Buffer.concat([
    currentContent.subarray(0, start),
    extractedStrings,
    currentContent.subarray(end)
  ]);

  if(pointersTableModeON===true &&
    currentContent.length>oldcurrentContentLength&&
    fileSizeMenuAction1.isChecked()===true){

    const currentSectionIndex = Number(sectionNameNumber.text())-1
    const maxAvailableSpace = getMaxAvailableSpace()
    const savedStringLength = savedString.length-1
    let lastStringData = getLast2CharaString()
    const isCurrentRowAndSection = lastStringData.mainIndex===currentSectionIndex&&lastStringData.secondaryIndex===listWidget.currentRow()
    
    if(savedStringLength>maxAvailableSpace&&!isCurrentRowAndSection){
      
      tableModeMasterDataObj[currentSectionIndex][listWidget.currentRow()]["stringBuffer"] = savedString.subarray(0,maxAvailableSpace)
      savedString = Buffer.concat([savedString.subarray(0,maxAvailableSpace),Buffer.alloc(1)])
      rawStrings[listWidget.currentRow()] = savedString
      extractedStrings = Buffer.concat(rawStrings)

      currentContent = Buffer.concat([
      currentContent.subarray(0, start),
      extractedStrings,
      currentContent.subarray(end+currentContent.length-oldcurrentContentLength)
      ]);
    }else{
      tableModeMasterDataObj[currentSectionIndex][listWidget.currentRow()]["stringBuffer"] = savedString.subarray(0,savedString.length-1)
    }

    let howMuchToCut = currentContent.length-oldcurrentContentLength
    const sizeDiff = currentContent.length-oldcurrentContentLength
    totalDeletedBytes = 0

    if(howMuchToCut===0) listWidget.currentItem().setText(currentItemBackup)

    while(howMuchToCut>0){
      lastStringData = getLast2CharaString()
      const howMuchIsAvailableToCut = tableModeMasterDataObj[lastStringData.mainIndex][lastStringData.secondaryIndex]["stringBuffer"].length-1
      const oldHowMuchToCut = howMuchToCut

      if(howMuchToCut>howMuchIsAvailableToCut){
        howMuchRemainIntact = 1
        howMuchToCut = howMuchToCut-howMuchIsAvailableToCut
      }else if(howMuchToCut===howMuchIsAvailableToCut){
        howMuchRemainIntact = 1
        howMuchToCut = 0
      }else{
        howMuchRemainIntact = howMuchIsAvailableToCut-howMuchToCut+1
        howMuchToCut = 0
      }
      const howMuchWillBeCutThisTime = oldHowMuchToCut-howMuchToCut
      const bufferToCheck = tableModeMasterDataObj[lastStringData.mainIndex][lastStringData.secondaryIndex]["stringBuffer"]
      const pointerToCheck = tableModeMasterDataObj[lastStringData.mainIndex][lastStringData.secondaryIndex]["pointerBuffer"]
      
      //Cut the unneeded part of the "last" string remembe to check duplicated
      tableModeMasterDataObj[lastStringData.mainIndex].forEach((item,index)=>{

        if(bufferToCheck.equals(item.stringBuffer)&&pointerToCheck.equals(item.pointerBuffer)){
          tableModeMasterDataObj[lastStringData.mainIndex][index]["stringBuffer"] = bufferToCheck.slice(0,howMuchRemainIntact);
        }
      })

      if(lastStringData.mainIndex>currentSectionIndex){
        lastStringOffsetLineEdit.setText((parseInt(lastStringOffsetLineEdit.text(),16)+howMuchWillBeCutThisTime).toString(16).toUpperCase())
      }
      //console.log(getMaxAvailableSpace())
      rebuildCurrentContentUsingMasterDataObj(tableModeMasterDataObj,oldTableModeMasterDataObj,lastStringData,sizeDiff)
      oldTableModeMasterDataObj = structuredClone(tableModeMasterDataObj)
    }
  }

  if(firstPointerOffsetInDecimal=== ""&&pointersTableModeON===false){

    spaceLeftFunc(extractedStrings)

  }else{
    stringOffsetFunc(currentContent)
    spaceLeftFunc(extractedStrings)
    pointerOffsetFunc(currentContent)
    hexValuesFunc(currentContent)
    pointerAdjuster(currentContent)
  }

  if(pointersTableModeON===true){
    pointersTableUpdater()
    spaceLeftFunc(extractedStrings)
    const lastStringPosition = parseInt(offsetOfEachString[offsetOfEachString.length-1],16)
    rawStrings[rawStrings.length-1] = currentContent.subarray(lastStringPosition,lastStringOffsetInDecimal)
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
//let newpass = [] debug
//let oldpass = []
function getMaxAvailableSpace(){
  const currentRow = listWidget.currentRow()
  const currentSection = Number(sectionNameNumber.text())-1
  let counter = 0
  //oldpass = structuredClone(newpass)
  //newpass = []
  let doBreak = false
  for(let i = sectionedCurrentContent.length - 1; i >= currentSection; i--) {
    for(let k = tableModeMasterDataObj[i].length - 1; k >= currentRow; k--) {
      counter = counter+tableModeMasterDataObj[i][k]["stringBuffer"].length-1
      //newpass.push(tableModeMasterDataObj[i][k]["stringBuffer"])
      
      if (i===currentSection&&k===currentRow){
        doBreak=true 
        break
      }
    }
    if(doBreak)break
  }
  
  return counter+1
  //-tableModeMasterDataObj[currentSection].length
}

function rebuildCurrentContentUsingMasterDataObj(fullData,oldFullData,modifiedStringIndexes,sizeDiff){
  if(pointersTableModeON){
    const lastSectionsNumber = sectionedCurrentContentLength
    let breakTime = false
    const deletedBytes = oldFullData[modifiedStringIndexes.mainIndex][modifiedStringIndexes.secondaryIndex]["stringBuffer"].length-fullData[modifiedStringIndexes.mainIndex][modifiedStringIndexes.secondaryIndex]["stringBuffer"].length
    
    for(let i = lastSectionsNumber;!breakTime&&i>=0;i--){

      const currentSectionIndex = Number(sectionNameNumber.text())-1
      const currentSectionStringIndex = listWidget.currentRow()
      const isCurrentSection = currentSectionIndex===i
      const nonCurrentSectionOffset = isCurrentSection? 0:sizeDiff

      for(let k = fullData[i].length-1;k>=0;k--){
        
        if(!fullData[i][k]||i>modifiedStringIndexes.mainIndex) break

        const iAndKAreSame = modifiedStringIndexes.mainIndex===i&&modifiedStringIndexes.secondaryIndex===k
        const currentSectionOffset = isCurrentSection? sizeDiff:0
        const offsetCharaAdded = isCurrentSection? 0:deletedBytes

        if(!iAndKAreSame&&!isCurrentSection||
          isCurrentSection&&k>currentSectionStringIndex){
          const exampleHex = selectedTablePointers[0].length
          
          //Updates pointer buffer
          if(bigEndian.isChecked()){
            const padInfo = getPaddingInfo(selectedTablePointers[0].length)
            fullData[i][k]["pointerBuffer"] = Buffer.from(applyPadding((fullData[i][k]["pointerBuffer"].readUint32BE(0)-offsetCharaAdded+currentSectionOffset).toString(16),exampleHex, padInfo),"hex")
          }else{
            fullData[i][k]["pointerBuffer"] = Buffer.from(padAndReverseHex((fullData[i][k]["pointerBuffer"].readUint32LE(0)-offsetCharaAdded+currentSectionOffset).toString(16),exampleHex),"hex")
          }
          fullData[i][k]["pointerBuffer"].copy(currentContent,fullData[i][k]["pointerPosition"]+nonCurrentSectionOffset)
        }else{
          const isCurrentSectionAndIndex = isCurrentSection&&k===currentSectionStringIndex
          let newStringBuffer = isCurrentSectionAndIndex? fullData[i][modifiedStringIndexes.secondaryIndex]["stringBuffer"]:fullData[i][k]["stringBuffer"]
          let newStringBufferPositionIndx = isCurrentSectionAndIndex? modifiedStringIndexes.secondaryIndex:k
          
          const endOffset = isCurrentSectionAndIndex&&modifiedStringIndexes.secondaryIndex===listWidget.currentRow()? 
          fullData[i][newStringBufferPositionIndx]["stringPosition"]
          :fullData[i][newStringBufferPositionIndx]["stringPosition"]+sizeDiff
          
          const startOffset = fullData[i][newStringBufferPositionIndx]["stringPosition"]+sizeDiff+oldFullData[modifiedStringIndexes.mainIndex][modifiedStringIndexes.secondaryIndex]["stringBuffer"].length

          let arrayToConcat = []
          arrayToConcat[0] = currentContent.subarray(0,endOffset)
          arrayToConcat[1] = newStringBuffer
          arrayToConcat[2] = currentContent.subarray(startOffset)
          totalDeletedBytes = totalDeletedBytes + deletedBytes
          currentContent =  Buffer.concat(arrayToConcat)
          breakTime = true

          if(currentSectionIndex===i){
            listWidget.item(newStringBufferPositionIndx).setText(arrayToConcat[1].toString())
            let nullBuffer = Buffer.alloc(1)
            rawStrings[modifiedStringIndexes.secondaryIndex] = Buffer.concat([arrayToConcat[1],nullBuffer])
          }
          break
        }
      }
      if(breakTime) break
      const selectedTablePointersBuff = Buffer.from(selectedTablePointers[i],"hex")
      
      let newselectedTablePointersBuff
      newselectedTablePointersBuff = Buffer.alloc(4);

      if(bigEndian.isChecked()){
        const currentValue = selectedTablePointersBuff.readUIntBE(0, 4);
        newselectedTablePointersBuff.writeIntBE(currentValue + (totalDeletedBytes - sizeDiff), 0, 4);
      }else{
        const currentValue = selectedTablePointersBuff.readUIntLE(0, 4);
        newselectedTablePointersBuff.writeIntLE(currentValue + (totalDeletedBytes - sizeDiff), 0, 4);
      }

      selectedTablePointers[i] = newselectedTablePointersBuff.toString("hex");

      const targetIndex = (i*2)+1;
      extractedTablePointersIn4[targetIndex] = Buffer.from(selectedTablePointers[i], "hex");
      sectionedCurrentContentLength--
      
      //newselectedTablePointersBuff.copy(currentContent, tablePointersIndexPositions[i])

      //Monitor pointers integrity DEBUG
      /**const checkPointersIntegrity = (buffer) => {
        const seenPointers = new Map();
        const limit = 0x40;

        for (let i = 0; i < limit; i += 4) {
          const pointerHex = buffer.subarray(i, i + 4).toString('hex').toUpperCase();
          
          if (pointerHex === "FFFFFFFF") break;

          if (seenPointers.has(pointerHex)) {
            console.warn(`%c [BUG DETECTED] Duplicated pointer: ${pointerHex}`);
            console.log(`Position: 0x${i.toString(16)} | First appareance: 0x${seenPointers.get(pointerHex).toString(16)}`);
          } else {
            seenPointers.set(pointerHex, i);
          }
        }
      };
      checkPointersIntegrity(currentContent);
      console.log("asd")
      */
    }
  }
}

//Uses tableModeMasterDataObj to get the last string in a file with pointer tables
function getLast2CharaString(){
  const lastMasterDataObjIndex = tableModeMasterDataObj.length-1

  for(let i = lastMasterDataObjIndex;i>=0;i--){
    const lastMasterDataObjIndexIndex = tableModeMasterDataObj[i].length-1
    
    for(let k = lastMasterDataObjIndexIndex;k>=0;k--){

      if(tableModeMasterDataObj[i][k]["stringBuffer"].length>1) return {mainIndex:i,secondaryIndex:k}
    }
  }
}

//Save all the input data of the user on settings.json
function saveConfiguration() {
  const currentSectionNumber = Number(sectionNameNumber.text());
  if (isNaN(currentSectionNumber)) {
    console.error("Can't save, section number is not valid.");
    return;
  }

  const newConfigData = {
    sectionNumber: currentSectionNumber,
    sectionName: sectionNameLineEdit.text(),
    firstPointerOffset: firstPointerOffsetLineEdit.text(),
    lastPointerOffset: lastPointerOffsetLineEdit.text(),
    firstStringOffset: firstStringOffsetLineEdit.text(),
    lastStringOffset: lastStringOffsetLineEdit.text(),
    filePath: filePathQLineEditRead.text(),
    encoding: UTF8Encoding ? "UTF8" : "SJIS"
  };

  let configurations = [];
  try {
    if (fs.existsSync("./settings.json")) {
      const fileContent = fs.readFileSync("./settings.json", 'utf8');
      if (fileContent) {
        configurations = JSON.parse(fileContent);
        if (!Array.isArray(configurations)) {
          configurations = [];
        }
      }
    }
  }catch (err) {
    console.error("Error reading settings.json file. A new file will be created.", err);
    configurations = [];
  }

  const existingConfigIndex = configurations.findIndex(
    config => config.sectionNumber === currentSectionNumber
  );

  if(existingConfigIndex !== -1) {
    configurations[existingConfigIndex] = newConfigData;
  }else {
    configurations.push(newConfigData);
  }
  
  configurations.sort((a, b) => a.sectionNumber - b.sectionNumber);

  try{
    const jsonString = JSON.stringify(configurations, null, 2);
    fs.writeFileSync("./settings.json", jsonString, 'utf8');
    
    console.log("Configuration successfully saved in settings.json!");

    if (newConfigData.sectionName) {
      sectionNameHeader = newConfigData.sectionName;
      sectionDetailsLabel.setText(`${sectionNameHeader}: String#N/A`);
    }

  } catch (err) {
    console.error("Error by saving at settings.json:", err);
    errorMessageBox.setWindowTitle("Error");
    errorMessageBox.setText("ERROR Configuration could not be saved.");
    errorMessageButton.setText("Ok");
    errorMessageBox.exec();
  }
}

//Resets everything
//options=1: default reset only
//options=2: default reset + pointer offset
//options=3: default reset + table mode
//options=4: default reset + offset inputs
function setDefaultValues(options){

  if (options===1){

  }else if(options===2){  
  firstPointerOffsetInDecimal= ""
  lastPointerOffsetInDecimal = ""
  }else if(options ===3){

    sectionedCurrentContent = []
    selectedTablePointers = []
    extractedTablePointersRaw = []
    extractedTablePointersIn4 = []
    extractedTablePointersIn4Non0 = []
    tableStartPointerFileOffsets = []
    tableEndPointerStartStringFileOffsets = []
    tableEndStringFileOffsets = []
    pointersTableModeSettingsArr = []
    currentTableContent = []
    organizedSections = []
    oldSelectedTablePointers = []
    sectionNameNumber.setText(1)
  }else if(options===4){
    firstPointerOffsetLineEdit.setText("")
    lastPointerOffsetLineEdit.setText("")
    firstStringOffsetLineEdit.setText("")
    lastStringOffsetLineEdit.setText("")
    offsetOfEachPointer = []
  }else{
    sectionNameLineEdit.setText("")
    firstPointerOffsetLineEdit.setText("")
    lastPointerOffsetLineEdit.setText("")
    firstStringOffsetLineEdit.setText("")
    lastStringOffsetLineEdit.setText("")
    currentContent = ""
    selectedFile = ""
    offsetOfEachPointer = []
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
  // string1OffsetDecimal= ""
  // string2OffsetDecimal = ""
  extractedStringsOLD = ""
  spaceLeftInSection = 0
  offsetOfEachString = []
  pointersHexValues = []
  addressOfEachStringInMemory= []
  extractedPointersIn4= []
  extractedPointers = ""
  oldPointersHexValues = []
  savedString = ""
  // projectsConfHexArr = []
  oldRawString = ""
  oldSelectedString = -1
  quantityOfSharedPointers = 0
  itemPositionOfSharedPointers = []

  hiddenPointers = 0
  stringsOffset = 0

  listWidget.clear()
  listWidget.scrollToTop()
  pointersViewerFull.clear()
  pointersViewerFull.scrollToTop()
  exportAllButton.setEnabled(false)
  csvButton.setEnabled(false)
  csvButton2.setEnabled(false)
  pointersViewerButtonToHide00.setEnabled(false)
  pointersEditorRealocateButton.setEnabled(false)
  pointersEditorSaveButton.setEnabled(false)
  pointersEditorLabel.setEnabled(false)
  pointersEditor.setEnabled(false)
  pointersViewerSpecific.setEnabled(false)
  mainMenuAction3.setEnabled(false)
  bigEndian.setEnabled(true)

  stringEditorTextEdit.setPlainText("")

  if(pointersTableModeON===false){
    sectionNameHeader= "Section name"
  }else{

  }

  sectionDetailsLabel.setText(`${sectionNameHeader}: String#N/A`)
  spaceLeftLabel.setText(`Space left: N/A`)
  pointerValuesLabel.setText(`Pointer HexValues: N/A`)
  pointerOffsetLabel.setText("Pointer Offset: N/A")
  stringOffsetLabel.setText(`String Offset: Offset/"RAM Address" (For MHG)`)
  pointersViewerTitleLabel.setText(`Pointers Viewer (Total) (Shared)`)
  choosedCharacters.setText("")
  searchLineEdit.setText("")
}

//Takes the data from settings.json and add it into the lineEdits.
function loadConfiguration() {
  const currentSectionNumber = Number(sectionNameNumber.text());

  if (isNaN(currentSectionNumber)) {
    console.error("The section number is not valid.");
    setDefaultValues();
    start();
    return;
  }

  if (currentSectionNumber<0) {
    console.error("The section number is not valid.");
    setDefaultValues();
    start();
    return;
  }

  try {
    if (!fs.existsSync("./settings.json")) {
      console.log("The settings.json file does not exist. Using default values.");
      setDefaultValues();
      start();
      return;
    }

    const fileContent = fs.readFileSync("./settings.json", 'utf8');
    
    const configurations = fileContent ? JSON.parse(fileContent) : [];

    const sectionConfig = configurations.find(
      config => config.sectionNumber === currentSectionNumber
    );

    if (!sectionConfig) {
      console.log(`No configuration found for the section ${currentSectionNumber}.`);

      if(hexViewBuffer){
        setDefaultValues(4);
      }else{
        setDefaultValues();
      }


      if (csvInfoGatheringMode === true) {
        stopCsvInfoGatheringMode = true;
      }
      start();
      return;
    }
    setDefaultValues();
    sectionNameLineEdit.setText(sectionConfig.sectionName || "");
    firstPointerOffsetLineEdit.setText(sectionConfig.firstPointerOffset || "");
    lastPointerOffsetLineEdit.setText(sectionConfig.lastPointerOffset || "");
    firstStringOffsetLineEdit.setText(sectionConfig.firstStringOffset || "");
    lastStringOffsetLineEdit.setText(sectionConfig.lastStringOffset || "");
    filePathQLineEditRead.setText(sectionConfig.filePath || "");

    selectedFile = sectionConfig.filePath || "";
    sectionNameHeader = sectionConfig.sectionName || "File Section Name:";
    sectionDetailsLabel.setText(`${sectionNameHeader}: String#N/A`);
    
    if (sectionConfig.encoding === "UTF8"){
      setUTF8Encoding(true)
    }else{
      setShiftJISEncoding(true)
    }
    
    start();

  }catch (err) {
    console.error("Error reading or parsing settings.json. Default values ​​will be used.", err);
    setDefaultValues();
    start();
  }
}

// +1 to sectionNameNumber
function plus1(tableMode,options){

  if(mibListObjsData.length>0){
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
    loadMibConfiguration(Number(sectionNameNumber.text()))
    return
  }

  if(tableMode===false){
    if(sectionNameNumber.text() === "255 "){
      return
    }
    if(sectionPaginationPointerFlag===0){
      sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
      loadConfiguration()

    }else if(options>1&&sectionPaginationPointerFlag===2){
      sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
      loadConfiguration()
      saveAndPrepare(true)

    }else if(options>1&&sectionPaginationPointerFlag===1){
      sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
      loadConfiguration()
      saveAndPreparePointerless(true)
    }

  }else{

    if(sectionNameNumber.text() === `${sectionedCurrentContent.length} `){
      return
    }
    savedString=""
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())+1}` + " ")
    sectionChangeInProcess = true
    loadPTConfiguration()
  }
}

// -1 to sectionNameNumber
function minus1(tableMode){

  if(sectionNameNumber.text() === "1 "){
    return
  }

  if(mibListObjsData.length>0){
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())-1}` + " ")
    loadMibConfiguration(Number(sectionNameNumber.text()))
    return
  }

  if(tableMode===false){
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())-1}` + " ")
    loadConfiguration()
  }else{
    savedString=""
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())-1}` + " ")
    sectionChangeInProcess = true
    loadPTConfiguration()
  }
}

//Moves section to 1
function goToFirstSection(){

  sectionNameNumber.setText(1 + " ")

  if(pointersTableModeON===false&&mibListObjsData.length===0){
    loadConfiguration()
  }else if(pointersTableModeON===true&&mibListObjsData.length===0){
    loadPTConfiguration()
  }else{
    loadMibConfiguration(Number(sectionNameNumber.text()))
  }
}

//Rearrange the text in the string editor with a character limit per line
function specificCharactersPerLine(){
  if(choosedCharacters.text() === ""||choosedCharacters.text() <=0){
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
    //stringEditorTextEdit.removeEventListener("textChanged")

    stringEditorTextEdit.setPlainText(charactersArr.join(""))

    // if(autoCharaAdjust.isChecked()===true){
    //   stringEditorTextEdit.addEventListener("textChanged",function (){
    //     specificCharactersPerLine(0)
    //   })
    // }
  }
}

// Opens file dialog and returns selected CSV path (or null if invalid)
function csvSelection() {
  const csvFileDialog = new QFileDialog();
  csvFileDialog.setFileMode(1)

  csvFileDialog.setNameFilter("*.csv");
  csvFileDialog.setWindowTitle("Choose a .csv file");
  
  let selectedCsv = null;
  const lstatSync = fs.lstatSync;
  const extname = path.extname;
  
  csvFileDialog.addEventListener("fileSelected", function(file) {
    if (file) {

      if (!lstatSync(file).isDirectory() && 
        extname(file).toLowerCase() === ".csv") {
        selectedCsv = file;
      }
    }
  });

  csvFileDialog.exec();
  
  return selectedCsv;
}

//Prompts user to select translation scope (current section vs all sections)
//before proceeding with CSV-based translation
async function csvTranslation(isWordOnlyTranslation) {

  const dialog = new QDialog();
  const row = new QWidget();
  const dialogLayout = new QBoxLayout(2);
  const rowLayout = new QBoxLayout(0);
  
  Object.assign(dialog, {
      windowTitle: "Select one translation option",
      fixedSize: { width: 300, height: 80 },
      modal: true
  });

  row.setLayout(rowLayout);
  dialog.setLayout(dialogLayout);
  dialogLayout.addWidget(row);

  const buttons = {
      thisSection: new QPushButton(),
      allSections: new QPushButton()
  };

  buttons.thisSection.setText("Strings in this section")
  buttons.allSections.setText("Strings in all sections")

  rowLayout.addWidget(buttons.thisSection);
  rowLayout.addWidget(buttons.allSections);

  buttons.thisSection.addEventListener("clicked", () => handleSectionSelection(dialog, isWordOnlyTranslation, true));
  buttons.allSections.addEventListener("clicked", () => handleSectionSelection(dialog, isWordOnlyTranslation, false));

  dialog.exec();
}

//Manages what user select for CSV translation
function handleSectionSelection(dialog, isWordOnlyTranslation, isSingleSection) {
  dialog.close();
  
  const selectedCsv = csvSelection();
  if (!selectedCsv) return;

  if(isSingleSection){
    processSingleSection(selectedCsv, isWordOnlyTranslation);
  }else {
    processAllSections(selectedCsv, isWordOnlyTranslation);
  }
}

//Only translates the current section
function processSingleSection(selectedCsv, isWordOnlyTranslation) {
  csvTranslationPhase2(selectedCsv, isWordOnlyTranslation, true);
  translatedStringsQProgressDialog.close();
  csvTranslationCanceled = false;
}

/**
 * Processes CSV translation across all available sections.
 * 
 * Handles two modes:
 * - Table mode: Iterates through sectionedCurrentContent array
 * - Normal mode: Navigates through sections using pagination until end is reached
 * 
 * Manages cancellation flags and progress dialog throughout the process.
 * 
 * @param {string} selectedCsv - Path to the selected CSV file
 * @param {boolean} isWordOnlyTranslation - If true, performs word-only translation mode
 */
function processAllSections(selectedCsv, isWordOnlyTranslation) {
  let endReached = false;
  csvInfoGatheringMode = true;
  sectionPaginationPointerFlag = firstPointerOffsetInDecimal ? 2 : 1;

  goToFirstSection();

  const processSection = () => {
    if (notCorrectDataSkipThisSection === false) {
      csvTranslationPhase2(selectedCsv, isWordOnlyTranslation, endReached);
    }

    notCorrectDataSkipThisSection = false;
  };

  if(pointersTableModeON) {
    for (let k = 0; k < sectionedCurrentContent.length; k++) {
      if (csvTranslationCanceled || stopCsvInfoGatheringMode) break;
      
      endReached = (k === sectionedCurrentContent.length - 1);
      processSection();
      
      if (!csvTranslationCanceled) plus1(true, 2);
    }
  }else {
    sectionPaginationPointerFlag === 2 ? saveAndPrepare(true) : saveAndPreparePointerless(true);
    
    while (!endReached && !csvTranslationCanceled) {
      if (stopCsvInfoGatheringMode) {
        endReached = true;
        csvTranslationCanceled = true;
      }
      
      processSection();
      if (!csvTranslationCanceled) plus1(pointersTableModeON, 2);
    }
  }

  translatedStringsQProgressDialog.close();
  sectionPaginationPointerFlag = 0;
  csvInfoGatheringMode = false;
  notCorrectDataSkipThisSection = false;
  stopCsvInfoGatheringMode = false;
  csvTranslationCanceled = false;
}

//Check if the given csv is valid (separated by semicolons)
//Organize the data from the csv given by the user, saving them in
//replacementStringsEncodedBuffer and stringToSearchEncodedBuffer.
function csvTranslationPhase2(selectedCsv, isWordOnlyTranslation, endReached) {

  const csvContent = fs.readFileSync(selectedCsv);
  let csvBinaryString = csvContent.toString('hex')
  .replace("efbbbf", "")
  .replaceAll("0d0a", "0a");

  if (!csvBinaryString.includes("3b")) {
    showCsvError();
    createCSVFile();
    return;
  }

  const { replacementBuffers, searchBuffers } = processCsvData(csvBinaryString);

  //Pair validation
  if (replacementBuffers.length !== searchBuffers.length) {
    showTranslationError();
    return;
  }

  const encodedData = encodeBuffers(replacementBuffers, searchBuffers);
  
  csvTranslationMode = true;
  foundAndReplaceIfMatch(encodedData.replacementBuffers, encodedData.searchBuffers, isWordOnlyTranslation, endReached);

  //Shows error message when CSV lacks semicolon separators
  function showCsvError() {
    errorMessageBox.setText("Seems to be that your .csv file is not separated by\nsemicolons, a .csv file separated by semicolons will be created in the root\nfolder, please try to use it.");
    errorMessageBox.setWindowTitle("Error, check your '.csv' file");
    errorMessageButton.setText("                                                Ok                                              ");
    errorMessageBox.exec();
  }

  //Shows error when translation pairs are mismatched
  function showTranslationError() {
    errorMessageBox.setWindowTitle("Error");
    errorMessageBox.setText("The csv contains strings without a translation or text to be translated");
    errorMessageButton.setText("                                                Ok                                              ");
    errorMessageBox.exec();
  }

  //Parses CSV binary data into arrays of replacement and search strings
  //Handles quoted text and semicolon/newline separators
  function processCsvData(binaryStr) {
    const replacements = [""];
    const searches = [""];
    let mode = 0;
    let k = 0, m = 0;

    for (let i = 0; i < binaryStr.length; i += 2) {
      const bytePair = binaryStr.substr(i, 2);

      if(bytePair==="22"){
        const startQuotes = i+2
        let endQuotes = 0
        for (let n=0;!(binaryStr.substr(startQuotes+n, 2)==="22"
        && binaryStr.substr(startQuotes+n+2, 2)==="3b")||
        !(binaryStr.substr(startQuotes+n, 2)==="22"
        && binaryStr.substr(startQuotes+n+2, 2)==="0a"
        &&binaryStr.substr(startQuotes+n+4, 2))==="3b";n += 2){
          endQuotes+=2
        }

        if(mode===0){
          replacements[k] = binaryStr.substr(startQuotes,endQuotes)
          k++
          replacements[k] = ""
          i += endQuotes+4
          mode = 1
        }else{
          searches[m] = binaryStr.substr(startQuotes,endQuotes)
          m++
          searches[m] = ""
          i += endQuotes+4
          mode = 0
        }
        continue
      }
      
      if (mode === 0) {
        if (bytePair !== "3b" && bytePair !== "0a") {
          replacements[k] += bytePair;
        } else {
          k++;
          replacements[k] = "";
          mode = 1;
        }
      } else {
        if (bytePair !== "3b" && bytePair !== "0a") {
          searches[m] += bytePair;
        } else {
          m++;
          searches[m] = "";
          mode = 0;
        }
      }
    }

    return {
      replacementBuffers: processTextChunks(replacements),
      searchBuffers: processTextChunks(searches)
    };
  }

  //Converts hex chunks into buffers, adding newlines between chunks
  function processTextChunks(chunks){
    const buffers = [];
    let temp = "";
    
    for (const chunk of chunks) {
      if (chunk === "" && temp) {

        buffers.push(Buffer.from(temp.slice(0, -2), "hex"));
        temp = "";
      } else if (chunk !== "") {
        temp += chunk + "0a";
      }
    }

    if (temp) {
      buffers.push(Buffer.from(temp.slice(0, -2), "hex"));
    }
    
    return buffers;
  }

  //Encodes buffers with proper character encoding (UTF-8 or Shift-JIS)
  //Also cleans up any quote artifacts from the CSV
  function encodeBuffers(replacements, searches) {
    const encode = (buffer) => {
      let text = buffer.toString("utf8")
      .replace(/\"\.\"/g, '."')
      .replace(/\"\"\"/g, '""')
      .replace(/\"\"/g, '"');

      if (shiftJISEncoding) {
        return Buffer.from(
          EncodingModule.convert(text, { to: 'SJIS', from: 'UNICODE' }),
          "binary"
        );
      }
      return Buffer.from(text);
    };

    return {
      replacementBuffers: replacements.map(encode),
      searchBuffers: searches.map(encode)
    };
  }
}

//Uses the data from stringToSearchEncodedBuffer/searchStrings
//to search for matches in currentContent, if found any, substitute it with the
//translated text in replaceStrings.
async function foundAndReplaceIfMatch(replaceStrings, searchStrings, isWordOnlyTranslation, endReached) {

  const rawStringsLength = rawStrings.length;
  const replaceStringsLength = replaceStrings.length;
  const hexCache = new Map();
  
  //In case of full string translation, this is done to maximize space
  const preprocessedSearches = isWordOnlyTranslation === true ? false : 
  searchStrings.map(s => {
    return s.toString("hex").replaceAll("0a200a", "0a0a");
  });

  translatedStringsQProgressDialog.setMaximum(rawStringsLength - 1);
  translatedStringsQProgressDialog.setLabelText("Waiting for 1° match in this section...");
  translatedStringsQProgressDialog.setWindowTitle("Task in progress, please wait");
  translatedStringsQProgressDialog.show();
  globalQApplication.processEvents();

  const lastCsvTranslationLogOriginal = [];
  const lastCsvTranslationLogReplacement = [];
  const lastCsvTranslationLogReplacementClean = [];

  //Handles a successful string match: updates UI, caches data, logs translation, and saves progress
  const processMatch = (i, k, replacement) => {
    const hexKey = `${i}-${k}`;
    if (!hexCache.has(hexKey)) {
      hexCache.set(hexKey, {
          label: `The string #${i+1} in this section of the file \nmatch with the csv string #${k+1}\ntranslating to:\n\n${replaceStrings[k]}`,
          replacement: replacement.toString("utf8")
      });
    }
    const cached = hexCache.get(hexKey);
    
    translatedStringsQProgressDialog.setLabelText(cached.label);
    globalQApplication.processEvents();
    
    lastCsvTranslationLogReplacement[i] = cached.replacement.replace(/\x00\x00/g, '[CHECK]');
    lastCsvTranslationLogReplacementClean[i] = cached.replacement.replace(/\x00/g, "");
    lastCsvTranslationLogOriginal[i] = rawStrings[i].toString("utf8");
    
    listWidget.setCurrentRow(i);
    
    saveProgress(true, replacement);
  };


  for (let i = 0; i < rawStringsLength; i++) {
    if (csvTranslationCanceled) break;

    for (let k = 0; k < replaceStringsLength; k++) {
      if (csvTranslationCanceled) break;

      const currentContentRawHex = rawStrings[i].toString("hex");
      const currentCSVSearchHex = isWordOnlyTranslation === true ? 
      searchStrings[k].toString("hex") : 
      preprocessedSearches[k];

      if (currentCSVSearchHex && currentContentRawHex.includes(currentCSVSearchHex)||currentContentRawHex===currentCSVSearchHex) {
        if (isWordOnlyTranslation) {
          const tempReplaceString = Buffer.from(
            currentContentRawHex.replaceAll(currentCSVSearchHex, replaceStrings[k].toString("hex")),
            "hex"
          );
          processMatch(i, k, tempReplaceString);
        } else{
          //Usually currentRawHex will be bigger, so is neccesary to add some 00's to currentSearchHex
          if(currentContentRawHex.length>=currentCSVSearchHex.length){
            let tempCurrentSearchHex = currentCSVSearchHex

            for(let m = 0;currentContentRawHex.length>tempCurrentSearchHex.length;m++){
              tempCurrentSearchHex = tempCurrentSearchHex+"00"
            }

            if(currentContentRawHex === tempCurrentSearchHex){
              processMatch(i, k, replaceStrings[k]);
            }
            else if(currentContentRawHex.replace(/0a(?!.*0a)/,"00")===tempCurrentSearchHex){
              processMatch(i, k, replaceStrings[k]);
            }
          }
        }
      }
    }

    translatedStringsQProgressDialog.setValue(i);
    globalQApplication.processEvents();
  }

  if (!isWordOnlyTranslation && firstPointerOffsetInDecimal !== "" && csvTranslationMode) {
    handlePostTranslation(endReached, true);
  } else if (!isWordOnlyTranslation && csvTranslationMode) {
    handlePostTranslation(endReached, false);
  }

  validateResults(
    lastCsvTranslationLogReplacementClean, 
    lastCsvTranslationLogReplacement, 
    endReached
  );


  //Handles post-translation cleanup and validation when using csv translation full string mode
  //Checks if string count changed and shows warning if needed
  function handlePostTranslation(endReached, usePointers) {
    const rawLength1 = rawStrings.length;

    if(mibListObjsData.length>0){
      usePointers ? saveAndPrepare(false) : saveAndPreparePointerless(false);
    }else{
      usePointers ? saveAndPrepare(true) : saveAndPreparePointerless(true);
    }

    const rawLength2 = rawStrings.length;

    if (rawLength1 > rawLength2) {
        showWarning(
          "Warning, check your last pointers/strings",
          `The process ended with fewer strings compared to\nwhen it started, please double-check the last\nstrings and pointers there are maybe some pointers\nduplicated.`,
          endReached
        );
    }
    csvTranslationMode = false;
  }

  //Checks for duplicates and strings that need review, shows appropriate warnings
  function validateResults(cleanLogs, replacementLogs, endReached) {
    const duplicates = cleanLogs.filter((item, index) => cleanLogs.indexOf(item) !== index);
    const needsCheck = replacementLogs
    .filter(replacement => replacement?.includes("[CHECK]"))
    .map(x => x?.replace(/\x00/g,"")?.replace("[CHECK]",""));

    if (duplicates.length || needsCheck.length) {
      showDetailedWarning(duplicates, needsCheck, endReached);
    }

    if (endReached) {
      showSimpleMessage("Task completed", "Task Completed");
    }
  }

  //Shows simple warning message box
  function showWarning(title, text, endReached) {
    errorMessageBox.setWindowTitle(title);
    errorMessageBox.setText(text);
    errorMessageButton.setText("OK".padStart(40).padEnd(40));
    errorMessageBox.exec();
    if (endReached) return;
  }

  //Shows detailed warning with list of duplicates and strings needing review
  function showDetailedWarning(duplicates, needsCheck, endReached) {
    let detailedText = "";
    if (needsCheck.length) {
      detailedText += `The following string(s) were translated at least\ntwo times:\n\n${needsCheck.join("\n\n")}\n\n`;
    }
    if (duplicates.length) {
      detailedText += `Duplicated strings needing check:\n\n${duplicates.join("\n\n")}`;
    }

    errorMessageBox.setWindowTitle("Warning");
    errorMessageBox.setText("The task finished with results that may need review");
    errorMessageBox.setDetailedText(detailedText);
    errorMessageButton.setText("OK".padStart(40).padEnd(40));
    errorMessageBox.exec();
    errorMessageBox.setDetailedText("Task completed.");
    if (endReached) return;
  }

  //Shows simple completion message (non-modal)
  function showSimpleMessage(title, text) {
    errorMessageBox.setWindowTitle(title);
    errorMessageBox.setText(text);
    errorMessageButton.setText("OK".padStart(40).padEnd(40));
    errorMessageBox.show();
  }
}

//Zzzzzz...
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

//Create and manage the different options of the selection window for the "export to csv" button
function exportAllSelectionScreen(){

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
  exportAllCheckButton.setText("Add section name")
  exportAllCheckButton.setCheckState(2)
  exportAllCheckButton.setToolTip("It will add the section name of each group of data.")

  const exportAllSelectionStringsButton = new QPushButton()
  const exportAllSelectionStringsAndMoreButton = new QPushButton()

  exportAllSelectionRow1Layout.addWidget(exportAllSelectionStringsButton)
  exportAllSelectionRow1Layout.addWidget(exportAllSelectionStringsAndMoreButton)
  exportAllSelectionMiddleRowLayout.addWidget(exportAllCheckButton,0,132)

  if(pointersTableModeON===false){

    const exportAllSelectionAllStringsButton = new QPushButton()
    const exportAllSelectionAllStringsAndMoreButton = new QPushButton()
    
    exportAllSelectionRow2Layout.addWidget(exportAllSelectionAllStringsButton)
    exportAllSelectionRow2Layout.addWidget(exportAllSelectionAllStringsAndMoreButton)

    exportAllSelectionDialogLayout.addWidget(exportAllSelectionRow1)
    exportAllSelectionDialogLayout.addWidget(exportAllSelectionMiddleRow)
    exportAllSelectionDialogLayout.addWidget(exportAllSelectionRow2)

    exportAllSelectionStringsAndMoreButton.addEventListener("clicked",function (){
      exportToCSVManager(0,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionStringsButton.addEventListener("clicked",function (){
      exportToCSVManager(1,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })

    exportAllSelectionAllStringsButton.addEventListener("clicked",function (){
      exportToCSVManager(2,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionAllStringsAndMoreButton.addEventListener("clicked",function (){
      exportToCSVManager(3,exportAllCheckButton.isChecked())
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
    if(firstPointerOffsetInDecimal === ""){

      exportAllSelectionStringsAndMoreButton.setToolTip("Exports all the Strings and their offsets found in this section\nof the file using this configuration.")
      
      exportAllSelectionAllStringsAndMoreButton.setToolTip("Exports all the strings and offsets found in all sections.\nWarning: Be sure that all the sections are properly set up")
    }else{

      exportAllSelectionStringsAndMoreButton.setToolTip("Exports all the Strings, Pointers, etc found in this section\nof the file using this configuration.")
      
      exportAllSelectionAllStringsAndMoreButton.setToolTip("Exports all the Strings, Pointers, etc found in all sections.\nWarning: Be sure that all the sections are properly set up")
    }

    exportAllSelectionDialog.exec()  

  }else if(pointersTableModeON===true){

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
    exportAllSelectionStringsInFolderButton.setToolTip("Export all the strings on all the Pointers Tables found\nin the Pointers Tables folder.\nWarning: Be sure that all the tables works without errors.")
    
    exportAllSelectionAllInFolderButton.setText("All")
    exportAllSelectionAllInFolderButton.setToolTip("All")
  
    exportAllSelectionStringsAndMoreButton.addEventListener("clicked",function (){
      exportToCSVManager(0,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionStringsButton.addEventListener("clicked",function (){
      exportToCSVManager(1,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionStringsInFolderButton.addEventListener("clicked",function(){
      exportToCSVManager(2,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionAllInFolderButton.addEventListener("clicked",function(){
      exportToCSVManager(3,exportAllCheckButton.isChecked())
      exportAllSelectionDialog.close(true)
    })
  
    win.addEventListener("Close", function (){
      exportAllSelectionDialog.close(true)
    })
  
    exportAllSelectionDialog.exec()
  }
}

//Generates CSV export with UTF-8 BOM, optional section name and offsets
//Splits multi-line strings into separate rows and sanitizes semicolons
function exportStringsAndOffsetOfSection(addFileName, exportOffsetsToo) {
  let dataToExport = [];
  const header = exportOffsetsToo? "String;offsetOfEachString\n":"String\n"
  dataToExport[0] = Buffer.from("efbbbf", "hex") + header
  let i = 0;
  let l = 1;
  
  if(addFileName === true) {
    dataToExport[l] = `# ${sectionNameLineEdit.text()}\n`;
    l++;
  }

  while (rawStrings[i] != undefined) {
    const text = checkForBlankSpaces(listWidget.item(i).text());
    const offset = offsetOfEachString[i].toString("hex");
    
    const lines = text.includes('\r\n')?text.split('\r\n'):text.split('\n')
    
    for (let j = 0; j < lines.length; j++) {
      const lineText = checkForSemicolons(lines[j], 0);
      
      if (j === 0) {
        dataToExport[l] = `${lineText}` + (exportOffsetsToo ? `;${offset}\n` : '\n');
      } else {
        dataToExport[l] = `${lineText}\n`;
      }
      l++;
    }
    
    dataToExport[l] = '\n';
    l++;
    i++;
  }

  return dataToExport.join("");
}

function exportStringsFromAllSections(options, addFileName) {
  let dataToExport = [];
  dataToExport[0] = Buffer.from("efbbbf", "hex") + "Strings\n";
  let l = 1;
  
  sectionPaginationPointerFlag = 1;
  csvInfoGatheringMode = true;
  goToFirstSection();
  
  if(mibListObjsData.length === 0) {
    saveAndPreparePointerless(true);
  }

  while(stopCsvInfoGatheringMode === false) {
    let i = 0;

    if(addFileName === true && !notCorrectDataSkipThisSection) {
      dataToExport[l] = `# ${sectionNameLineEdit.text()}\n`;
      l++;
    }

    while(rawStrings[i] !== undefined && !notCorrectDataSkipThisSection) {
      const text = checkForBlankSpaces(listWidget.item(i).text());
      const lines = text.includes('\r\n')?text.split('\r\n'):text.split('\n')
      
      for(let j = 0; j < lines.length; j++) {
        const lineText = checkForSemicolons(lines[j], 0);
        dataToExport[l] = `${lineText}\n`;
        l++;
      }
      
      dataToExport[l] = '\n';
      l++;
      i++;
    }

    if(!notCorrectDataSkipThisSection) {
      notCorrectDataSkipThisSection = false;
      plus1(pointersTableModeON, options);
    } else {
      notCorrectDataSkipThisSection = false;
    }
  }

  return dataToExport.join("");
}

//Navigates through all sections (using section pagination) and exports their strings
//Skips invalid sections, includes section names,
//Continues until stop flag is set
function exportStringsOffsetAndPointersFromAllSections(options, addFileName) {
  let dataToExport = [];
  dataToExport[0] = Buffer.from("efbbbf", "hex") + 
  "String;offsetOfEachString;offsetOfEachStringInMemory;offsetOfEachPointer;PointerHexadecimalValue;FullPointers\n";
  
  let i = 0;
  let l = 1;
  
  csvInfoGatheringMode = true;
  if(options===3){
    goToFirstSection();
  }
  if(mibListObjsData.length === 0) {

    firstPointerOffsetLineEdit.text() ?
    saveAndPrepare(true) :
    saveAndPreparePointerless(true);
  }

  while(stopCsvInfoGatheringMode === false) {
    i = 0;

    if(addFileName && !notCorrectDataSkipThisSection) {
      dataToExport[l] = `# ${sectionNameLineEdit.text()}\n`;
      l++;
    }

    while(rawStrings[i] !== undefined && !notCorrectDataSkipThisSection) {
      const textToSplit = checkForBlankSpaces(listWidget.item(i).text())
      const textLines = textToSplit.includes('\r\n')?textToSplit.split('\r\n'):textToSplit.split('\n')
      const offset = offsetOfEachString[i].toString("hex");

      for (let j = 0; j < textLines.length; j++) {
        let line = `${checkForSemicolons(textLines[j], 0)};`;
        
        if (j === 0) {
          line += `${offset};`;
          
          if(firstPointerOffsetLineEdit.text()) {

            line += `${addressOfEachStringInMemory[i].toString("hex").toUpperCase().replaceAll("00","")};`
            line += `${offsetOfEachPointer[i]};`
            line += `${pointersHexValues[i].toString("hex").toUpperCase()}`
            
            if(rawStrings[i+1] === undefined) {
              let fullPointers = [];
              let k = 0;
              while(extractedPointersIn4[k] !== undefined) {
                fullPointers.push(extractedPointersIn4[k].toString("hex").toUpperCase());
                k++;
              }
              if(fullPointers.length > 0) {
                line += `;${fullPointers.join(';')}`;
              }
            }
          }
        }
        if(j+1 === textLines.length){
          line = line + '\n'
        }
        dataToExport[l] = line + '\n';
        l++;
      }
      
      i++;
    }

    if(options === 0) {
      return dataToExport.join("");
    }

    if(!notCorrectDataSkipThisSection) {
      //dataToExport[l] = '\n';
      l++;
    }
    plus1(pointersTableModeON, options);
  }
  
  return dataToExport.join("");
}

//Routes export requests to appropriate handler based on export mode
// Mode 0: full data (strings, offsets, pointers)
// Mode 1: strings only
// Mode 2: All PTs strings only (delegates to handleMultiPTExport)
// Mode 3: All PTs full data (delegates to handleMultiPTExport)
function handlePointersTableExport(exportOptionNumber, addFileName) {

  let dataToExport = [];
  dataToExport[0] = Buffer.from("efbbbf", "hex")+ 
  (exportOptionNumber?"String\n"
  :"String;offsetOfEachString;offsetOfEachStringInMemory;offsetOfEachPointer;PointerHexadecimalValue;FullPointers\n");

  let i = 0;
  let l = 1;
  let m = 0
  csvInfoGatheringMode = true;
  goToFirstSection()
  //Export all from this .pt
  if (exportOptionNumber === 0) {
    while (m <= sectionedCurrentContent.length) {
      i = 0;

      if (addFileName&& !notCorrectDataSkipThisSection) {
        if (dataToExport[l] === undefined) dataToExport[l] = "";
        dataToExport[l] = `# ${sectionNameLineEdit.text()} ${sectionNameNumber.text()}\n`;
        l++;
      }
      
      while (rawStrings[i] !== undefined&& !notCorrectDataSkipThisSection) {
        const textToSplit = checkForBlankSpaces(listWidget.item(i).text())
        const textLines = textToSplit.includes('\r\n')?textToSplit.split('\r\n'):textToSplit.split('\n')

        let line = ''
        for (let j = 0; j < textLines.length; j++) {

          line = `${checkForSemicolons(textLines[j], 0)};`;
          if(j===0){
            line += `${offsetOfEachString[i].toString("hex")};`;
            line += `${addressOfEachStringInMemory[i].toString("hex").toUpperCase().replaceAll("00","")};`;
            line += `${offsetOfEachPointer[i]};`;
            line += `${pointersHexValues[i].toString("hex").toUpperCase()}`;

            if (rawStrings[i + 1] === undefined) {
              let fullPointers = [];
              let k = 0;
              while (extractedPointersIn4[k] !== undefined) {
                fullPointers.push(extractedPointersIn4[k].toString("hex").toUpperCase());
                k++;
              }
              if(fullPointers.length > 0) {
                line += `;${fullPointers.join(';')}`;
              }
            }
          }

          if(j+1 === textLines.length){
            line = line + '\n'
          }
          dataToExport[l] = line + '\n';
          l++;
        }
        i++;
      }

      if(!notCorrectDataSkipThisSection) {
        //dataToExport[l] = '\n';
        m++;
      }
      plus1(pointersTableModeON);
    }
  } 
  //Export all strings of this .pt
  else if (exportOptionNumber === 1) {
    while (m != sectionedCurrentContent.length) {
      i = 0;
      if (addFileName) {
        if (dataToExport[l] === undefined) dataToExport[l] = "";
        dataToExport[l] += `# ${sectionNameLineEdit.text()} ${sectionNameNumber.text()}\n`;
      }
      
      while (rawStrings[i] !== undefined) {
        dataToExport[l] += checkForSemicolons(checkForBlankSpaces(listWidget.item(i).text()), 0) + `\n\n`;
        i++;
      }
      m++;
      plus1(pointersTableModeON);
    }
  }
  //Export strings of all .pt
  else if (exportOptionNumber === 2) {
    return handleMultiPTExport(addFileName, false);
  }
  //Export all from all .pt
  else if (exportOptionNumber === 3) {
    return handleMultiPTExport(addFileName, true);
  }
  
  return dataToExport;
}

//Manages multiple .pt files
async function handleMultiPTExport(addFileName, includePointers) {
  const ptFilesList = await getPTFilesList();
  if (!ptFilesList) return [];

  const dataToExportFinal = [];
  const dirPath = path.dirname(selectedPTFile);

  for (let m = 0; m < ptFilesList.length; m++) {
    
    let dataToExport = [];
    selectedPTFile = `${dirPath}/${ptFilesList[m]}`;
    loadPointersTable(selectedPTFile);

    dataToExport[0] = Buffer.from("efbbbf", "hex") + 
    (includePointers
    ? "String;offsetOfEachString;offsetOfEachStringInMemory;offsetOfEachPointer;PointerHexadecimalValue;FullPointers\n"
    : "String\n");

    let l = 1;

    //Sections
    for (let n = 0; n < sectionedCurrentContent.length; n++) {
      if (addFileName && !notCorrectDataSkipThisSection) {
        dataToExport[l] = `# ${sectionNameLineEdit.text()} ${sectionNameNumber.text()}\n`;
        l++;
      }

      //String
      for (let i = 0; i < rawStrings.length && !notCorrectDataSkipThisSection; i++) {
        const textToSplit = checkForBlankSpaces(listWidget.item(i).text())
        const textLines = textToSplit.includes('\r\n')?textToSplit.split('\r\n'):textToSplit.split('\n')
        
        //String lines
        for (let j = 0; j < textLines.length; j++) {
          let line = `${checkForSemicolons(textLines[j], 0)}`;
          
          if (j === 0 && includePointers) {
            line += `;${offsetOfEachString[i].toString("hex")}`;
            line += `;${addressOfEachStringInMemory[i].toString("hex").toUpperCase().replaceAll("00","")}`;
            line += `;${offsetOfEachPointer[i]}`;
            line += `;${pointersHexValues[i].toString("hex").toUpperCase()}`;

            if (i === rawStrings.length - 1) {
              const fullPointers = [];
              for (let k = 0; extractedPointersIn4[k] !== undefined; k++) {
                fullPointers.push(extractedPointersIn4[k].toString("hex").toUpperCase());
              }
              if (fullPointers.length > 0) {
                line += `;"${fullPointers.join(';')}"`;
              }
            }
          }

          if(j+1 === textLines.length){
            line = line + '\n'
          }
          dataToExport[l] = line + '\n';
          l++;
        }
      }

      if (!notCorrectDataSkipThisSection) {
        dataToExport[l] = '\n';
        l++;
      }
      plus1(pointersTableModeON);  
    }
    dataToExportFinal[m] = dataToExport.join("");
  }

  return dataToExportFinal;
}

//Obtain list of .pt files
async function getPTFilesList() {
  try {
    const dirPath = path.dirname(selectedPTFile)
    const list = await fs.promises.readdir(dirPath);
    return list.filter(file => 
    file.endsWith('.pt') && 
    !fs.lstatSync(`${dirPath}/${file}`).isDirectory()
    );
  } catch (err) {
  errorMessageBox.setWindowTitle("Error");
  errorMessageBox.setText("ERROR! The folder doesn't exist or there are not files.");
  errorMessageButton.setText("                                                Ok                                              ");
  errorMessageBox.exec();
  return null;
  }
}

//Check if the given string has semilcolons, if found one, add "" to the line where is the semicolon.
//Additionally, also search for + and - at the start of a line, if found one, add a space at the start of the line.
function checkForSemicolons(listWidgetString,style){
  let i = 0
  if(listWidgetString.includes(";")===true){

    if(style===0){
      listWidgetString = listWidgetString.split("\n")
    }else if(style===1){
      listWidgetString = listWidgetString.split(";\r\n")
    }else{
      listWidgetString = listWidgetString.split("\r\n")
    }

    while(listWidgetString[i]!=undefined){

      if(listWidgetString[i].includes(";")
      &&listWidgetString[i][0]!=`"`
      &&listWidgetString[i][listWidgetString[i]-1]!=`"`){
        
        listWidgetString[i] = `"${listWidgetString[i]}"`

      }
      i=i+1
    }
  }

  if(listWidgetString.includes("-")===true||listWidgetString.includes("+")===true){

    i = 0

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

//Check if a given string contains multiple newlines consecutively. If so, add spaces between them.
function checkForBlankSpaces(listWidgetString) {
  if (!listWidgetString) return listWidgetString;
  
  let result = listWidgetString.replace(/(\n){2,}/g, match => 
    match.split('').join(' ')
  );

  if (result.startsWith('\n')) {
    result = ' ' + result;
  }
  if (result.endsWith('\n')) {
    result = result + ' ';
  }

  return result;
}

//Makes a csv that contains the strings and pointers from currentContent.
async function exportToCSVManager(exportOptionNumber,addFileName){

  let exportedData = Buffer.from("efbbbf0d0a", "hex")
  let exportedDataFinal = []
  if(!pointersTableModeON){

    if(firstPointerOffsetInDecimal === ""){

      //Offset and strings in this section
      if(exportOptionNumber===0){
        exportedData = exportStringsAndOffsetOfSection(addFileName,true)

      //Only Strings in this section
      }else if(exportOptionNumber===1){
        exportedData = exportStringsAndOffsetOfSection(addFileName,false)
  
      //Strings from all sections
      }else if(exportOptionNumber===2){
        exportedData = exportStringsFromAllSections(exportOptionNumber,addFileName)
      
      //Strings and offset from all sections
      }else if(exportOptionNumber===3){
        sectionPaginationPointerFlag = 1
        exportedData = exportStringsOffsetAndPointersFromAllSections(exportOptionNumber,addFileName)
      }

    }else if (firstPointerOffsetInDecimal != ""){
      //Export all of this section
      if(exportOptionNumber===0){
      exportedData = exportStringsOffsetAndPointersFromAllSections(exportOptionNumber,addFileName)
      
      //Export strings of this section
      }else if(exportOptionNumber===1){
        exportedData = exportStringsAndOffsetOfSection(addFileName,false)

      //Export strings of all sections
      }else if(exportOptionNumber===2){
        exportedData = exportStringsFromAllSections(exportOptionNumber,addFileName)
  
      //Export all of all sections
      }else if(exportOptionNumber===3){
        sectionPaginationPointerFlag = 2
        exportedData = exportStringsOffsetAndPointersFromAllSections(exportOptionNumber,addFileName)
      }
    }
  }else if (pointersTableModeON) {

    if (exportOptionNumber < 2) {
      exportedData = handlePointersTableExport(exportOptionNumber, addFileName);
    } else {
      exportedDataFinal = await handlePointersTableExport(exportOptionNumber, addFileName);
    }
  }

  
  sectionPaginationPointerFlag =0
  notCorrectDataSkipThisSection = false
  stopCsvInfoGatheringMode=false
  csvInfoGatheringMode= false

  if(exportedDataFinal[0]===undefined){

    if(Array.isArray(exportedData)===true){
      exportedData = exportedData.join("")
    }

    fs.writeFile(`./exportedData_${Date.now()}.csv`,`${exportedData}`,{
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

    exportedDataFinal = exportedDataFinal.join("")

    fs.writeFile(`./exportedData_${Date.now()}.csv`,`${exportedDataFinal}`,{
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
  let i = 0;
  hiddenPointers = 0;
  while(extractedPointersIn4[i]!= undefined){
    
    if(pointersViewerFull.item(i).text()==="00000000"&& pointersViewerButtonToHide00.isChecked()===true){
      pointersViewerFull.item(i).setHidden(true)
      hiddenPointers = hiddenPointers+1;
    }

    if(pointersViewerFull.item(i).text()==="00000000"&& pointersViewerButtonToHide00.isChecked()===false){
      pointersViewerFull.item(i).setHidden(false)
    }
    i=i+1;
  }

  pointersViewerTitleLabel.setText(`Pointers Viewer (${extractedPointersIn4.length-hiddenPointers}) (${quantityOfSharedPointers})`)
}

//When a string is clicked in the main list widget this function search it hex values in the
//pointers viewer, if found a match, is selected.
function highlightPointers(relocateMode = false){
  
  if(firstPointerOffsetInDecimal!= ""){
    let i = 0;
    quantityOfSharedPointers=1

    while(extractedPointersIn4[i] != undefined){ //Search strings

      if(pointersHexValues[listWidget.currentRow()]
        &&extractedPointersIn4[i].toString("hex").toUpperCase() === pointersHexValues[listWidget.currentRow()].toString("hex").toUpperCase()){
        
        if(!relocateMode){
          pointersEditor.clear()
          pointersEditorLabel.setText("#n")
          pointersViewerFull.setCurrentRow(i)
        }
        break

      }else if(i+2>extractedPointersIn4.length){

        pointersEditor.clear()
        pointersEditorLabel.setText("#n")
        errorMessageBox.setWindowTitle("Error")
        errorMessageBox.setText(`Oh no, the string #${listWidget.currentRow()+1} has 0 pointers associated with it\nare you sure that both pointer offsets are correct?\nIf that is the case may the pointers of this string are\nin another place or the pointers are in Big Endian.`)
        errorMessageButton.setText("                                                Ok                                              ")
        errorMessageBox.exec()
        return false
      }
      i=i+1;
    }
  }
}

//It saves the file. Or tries to.
//Shows error dialog if file is in use or write fails
function saveCurrentContent(){
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

//Returns {text, stringPosition, pointerPosition} for the currently selected string
//text: raw string bytes up to first null
//stringPosition: offset of string
//pointerPosition: offset of pointer that references this string
function currentStringSelectedData(){
  if(listWidget.currentRow()===-1||pointersViewerFull.currentRow()===-1) return

  const currentStringPositionInFile = parseInt(offsetOfEachString[listWidget.currentRow()],16)
  
  let i = 0
  for(i = 0;currentContent[currentStringPositionInFile+i]!==0;++i){}

  const outputText = Buffer.from(currentContent.subarray(currentStringPositionInFile,currentStringPositionInFile+i))
  const pointerPositionInFile = offsetOfEachPointer[itemPositionOfSharedPointers[pointersViewerSpecific.currentRow()]]
  

  return {text:outputText,stringPosition:currentStringPositionInFile,pointerPosition:pointerPositionInFile}
}

/**
 * Relocates a string to a new position in the file and updates its pointer.
 * 
 * Process:
 * 1. Validates new position is within file bounds
 * 2. Calculates position difference and final string location
 * 3. Checks if destination has enough null space for the string
 * 4. If space available:
 *    - Clears original string position (with nulls)
 *    - Updates pointer value with new position
 *    - Moves string to new location by reconstructing file buffer
 *    - Saves file and refreshes views
 * 5. Shows error if destination space insufficient
 * 
 * @param {number} newStringPositionInFile - Desired file offset for the string
 * @param {string} listWitgetPointerText - Current pointer value as hex string
 * @returns {void}
 */
function relocateStringPosition(newStringPositionInFile,listWitgetPointerText){
  let currentStringPosition

  const currentStringData = currentStringSelectedData()
  if(!currentStringData) return

  if(bigEndian.isChecked()){
    currentStringPosition = Buffer.from(listWitgetPointerText,"hex").readUint32BE(0)
  }else{
    currentStringPosition = Buffer.from(listWitgetPointerText,"hex").readUint32LE(0)
  }

  if(newStringPositionInFile>currentContent.length){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("The selected position for the new string is out the boundries of the file")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }

  //PositionDifference can be positive or negative
  const positionDifference = newStringPositionInFile-currentStringData.stringPosition

  const finalStringPosition = currentStringData.stringPosition+ positionDifference
  
  let freeSpaceInDestination
  for(let i=0;currentContent[finalStringPosition+i]===0;i++){
    freeSpaceInDestination = i
  }

  if(freeSpaceInDestination>currentStringData.text.length){

    //Put 0's in the current String place
    if(pointersViewerSpecific.count()===1){
      for(let i = 0;currentContent[currentStringData.stringPosition+i]!==0;++i){
        currentContent[currentStringData.stringPosition+i]=0
      }
    }

    const pointersLength = pointersViewerFull.currentItem().text().length
    const padInfo = getPaddingInfo(pointersLength);
    let newPointerValue
    if(bigEndian.isChecked()){
      newPointerValue = applyPadding((currentStringPosition+positionDifference).toString(16).toUpperCase(),pointersLength, padInfo);
    }else{
      newPointerValue = padAndReverseHex((currentStringPosition+positionDifference).toString(16).toUpperCase(),pointersLength)
    }

    const newPointerBuffer = Buffer.from(newPointerValue,"hex")
    newPointerBuffer.copy(currentContent, currentStringData.pointerPosition)

    const head = currentContent.subarray(0,finalStringPosition)
    const body = currentContent.subarray(finalStringPosition+currentStringData.text.length,currentContent.length)

    currentContent = Buffer.concat([head,currentStringData.text,body])

    saveCurrentContent()

    const mibsModeIsOn = mibListObjsData>0
    saveAndPrepare(mibsModeIsOn)

    if(hexViewBuffer){
      shutdownHexView()
    }

  }else{
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Not enough space (null/00 values) found in the selected position")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }
}

/**
 * Main entry point for string relocation operations. Handles multiple scenarios:
 * 
 * 1. Validation: Checks if a string is selected and not is the first one (first one can't be relocated)
 * 2. Hex View: Opens hex viewer if pointer editor field is empty (visual aid to choose where will be the new string)
 * 3. Direct Relocation: If pointer editor field has already a pointer, the value is used as the new pointer
 * 4. Space Extension: Creates new string at the end of section by:
 *    - Finding null space after the last string
 *    - Converting a null byte to space (0x20) to create a new string
 *    - Editing the selected pointer to point to this new string
 *    - Adjusting all subsequent pointers accordingly
 * 
 * Also handles pointer validation, space checking, and UI updates.
 * 
 * @returns {void}
 */
function relocateToNewString(){

  if(listWidget.currentRow()===-1){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("No string selected")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }else if(listWidget.currentRow()===0){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("First string can't be relocated")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }

  if(highlightPointers(true)===false) return
  
  if(pointersEditor.text()===""){

    const encoding = UTF8Encoding?"UTF8":"SJIS"
    const row = pointersViewerSpecific.currentRow()===-1?0:pointersViewerSpecific.currentRow()
    
    const listWitgetObj = {
      text: pointersViewerFull.currentItem().text(),
      row:row
    }

    hexView(selectedFile,encoding,listWitgetObj)

    return
  }
  
  if(pointersEditor.text().match(/^(?:[0-9A-F]{8})$/i)===null){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("The new pointer values are not valid")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }
  
  const textToInsertData = currentStringSelectedData()

  //Check if there are NOT enough 00's at the end of the string section that is being edited
  if(spaceLeftInSection<textToInsertData.text.length
  &&pointersViewerSpecific.currentItem().text()===pointersEditor.text()){

    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("Not enough space (null/00 values) in the strings interval")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return

  //Creates a new string and make the selected pointer point to it
  }else if (pointersViewerSpecific.currentItem().text()===pointersEditor.text()){
    let i = 0;
    let newStringOffsetDecimal =""
    while(currentContent[parseInt(offsetOfEachString[offsetOfEachString.length-1],16)+i] !="00"){

      if(currentContent[parseInt(offsetOfEachString[offsetOfEachString.length-1],16)+i+1] ===0 && currentContent[parseInt(offsetOfEachString[offsetOfEachString.length-1],16)+i+2] ===0){

        newStringOffsetDecimal = (parseInt(offsetOfEachString[offsetOfEachString.length-1],16)+i+2).toString(16).toUpperCase()
        break
      }
      i=i+1;
    }

    currentContent[parseInt(newStringOffsetDecimal,16)] = 32

    let firstPointerW = pointersViewerFull.item(0).text()

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

    let differenceInDecimals = parseInt(newStringOffsetDecimal,16)-parseInt(offsetOfEachString[0],16)
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

      while(k<Math.trunc(newStringOffsetDecimal.toString(16).length/2)){
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

    const mibsModeIsOn = mibListObjsData>0
    saveAndPrepare(mibsModeIsOn)

    listWidget.scrollToBottom()

    if(hexViewBuffer){
      shutdownHexView()
    }
  
  //Move the string to a new position and edit it pointer to point that position
  }else if(pointersViewerSpecific.currentItem().text()!==pointersEditor.text()){
    
    let newStringPositionInFile
    const currentStringData = currentStringSelectedData()
    if(bigEndian.isChecked()){
      newStringPositionInFile = currentStringData.stringPosition+(Buffer.from(pointersEditor.text(),"hex").readUint32BE(0)-Buffer.from(pointersViewerSpecific.currentItem().text(),"hex").readUint32BE(0))
    }else{
      newStringPositionInFile = currentStringData.stringPosition+(Buffer.from(pointersEditor.text(),"hex").readUint32LE(0)-Buffer.from(pointersViewerSpecific.currentItem().text(),"hex").readUint32LE(0))
    }
    
    relocateStringPosition(newStringPositionInFile,pointersViewerSpecific.currentItem().text())
  }
}

//When a item in the pointers viewer is edited, needs to change its highlight to make it
//match with its new values (same goes for specific pointers viewer), this
//function does that and also saves the pointer changed in currentContent to the file.
function saveEditedPointer(){

  if(pointersEditor.text().match(/^(?:[0-9A-F]{8})$/i) ===null){
    errorMessageBox.setWindowTitle("Error")
    errorMessageBox.setText("The new pointer values are not valid")
    errorMessageButton.setText("                                                Ok                                              ")
    errorMessageBox.exec()
    return
  }
  extractedPointersIn4[itemPositionOfSharedPointers[pointersViewerSpecific.currentRow()]] =  Buffer.from(pointersEditor.text(),"hex")
  pointersViewerSpecific.currentItem().setText(pointersEditor.text())
  pointersViewerFull.item(itemPositionOfSharedPointers[pointersViewerSpecific.currentRow()]).setText(pointersEditor.text())
  pointersViewerSpecific.currentItem().setText(pointersEditor.text())

  extractedPointers = Buffer.concat(extractedPointersIn4);

  const start = firstPointerOffsetInDecimal;
  const end = lastPointerOffsetInDecimal;

  currentContent = Buffer.concat([
    currentContent.subarray(0, start),
    extractedPointers,
    currentContent.subarray(end)
  ]);

  pointersViewerFull.removeItemWidget(pointersViewerFull.item(itemPositionOfSharedPointers[pointersViewerSpecific.currentRow()]))

  if(pointersViewerSpecific.currentRow()===0){
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
    pointersViewerFull.setItemWidget(pointersViewerFull.item(itemPositionOfSharedPointers[pointersViewerSpecific.currentRow()]),pointerViewerListQWidget)
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
    pointersViewerFull.setItemWidget(pointersViewerFull.item(itemPositionOfSharedPointers[pointersViewerSpecific.currentRow()]),pointerViewerListQWidget2)
    quantityOfSharedPointers=quantityOfSharedPointers+1;
  }
  saveCurrentContent()
}

//Creates several windows one after another to gather info to create a .pt file to manage a pointers table.
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
  
  //Pointers Table Offsets--------------------------------------------------------

  const firstPointerTableOffsetLineEdit = new QLineEdit();
  const lastPointerTableOffsetLineEdit = new QLineEdit();
  firstPointerTableOffsetLineEdit.setToolTip("1° Pointers Table Index pointer offset in the file (without 0x). Usually is 0.")
  firstPointerTableOffsetLineEdit.setPlaceholderText("First pointer offset")
  lastPointerTableOffsetLineEdit.setPlaceholderText("Post-last pointer offset")
  lastPointerTableOffsetLineEdit.setToolTip("Post-last Pointers Table Index pointer offset in the file (without 0x).\nUsually is the starting offset of FFFFFFFFFFFFFFFF")
  lastPointerTableOffsetLineEdit.setInlineStyle(`
  width:118px;
  font-size:11px;
  `)
  firstPointerTableOffsetLineEdit.setInlineStyle(`
  width:119px;
  font-size:11px;
  `)
  const pointerTableOffsetWidget = new QWidget()
  const pointerTableOffsetTitleWidget = new QWidget()
  const pointerTableOffsetLineEditWidget = new QWidget()

  createPointersDialogLayout.addWidget(pointerTableOffsetWidget)

  const pointerTableOffsetWidgetLayout = new FlexLayout()
  const pointerTableOffsetTitleWidgetLayout = new FlexLayout()
  const pointerTableOffsetLineEditWidgetLayout = new FlexLayout()

  pointerTableOffsetTitleWidget.setInlineStyle(`
  flex-direction:row;

  `)
  pointerTableOffsetLineEditWidget.setInlineStyle(`
  flex-direction:row;
  `)

  pointerTableOffsetWidget.setLayout(pointerTableOffsetWidgetLayout)
  pointerTableOffsetTitleWidget.setLayout(pointerTableOffsetTitleWidgetLayout)
  pointerTableOffsetLineEditWidget.setLayout(pointerTableOffsetLineEditWidgetLayout)

  const pointerTableOffsetLineEditTitle = new QLabel();
  pointerTableOffsetLineEditTitle.setText("Pointers Table Index *")
  pointerTableOffsetLineEditTitle.setAlignment(132)
  pointerTableOffsetLineEditTitle.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  pointerTableOffsetLineEditWidgetLayout.addWidget(firstPointerTableOffsetLineEdit)
  pointerTableOffsetLineEditWidgetLayout.addWidget(lastPointerTableOffsetLineEdit)

  pointerTableOffsetWidgetLayout.addWidget(pointerTableOffsetLineEditTitle)
  pointerTableOffsetWidgetLayout.addWidget(pointerTableOffsetLineEditWidget)

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


  //First Pointer of the first Table Offset--------------------------------------------------------

  const firstPointerTitle = new QWidget();

  const firstPointerTitleLayout = new FlexLayout();
  firstPointerTitle.setLayout(firstPointerTitleLayout)
  // createPointersDialogLayout.addWidget(firstPointerTitle)

  const firstPointerTitleLabel = new QLabel()
  firstPointerTitleLabel.setText("1° Pointer offset of the 1° Pointers Table *")
  firstPointerTitleLabel.setAlignment(132)
  firstPointerTitleLabel.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  firstPointerTitleLayout.addWidget(firstPointerTitleLabel)

  const firstPointerOffsetLineEdit2 = new QLineEdit();
  firstPointerOffsetLineEdit2.setPlaceholderText("1° Pointer of the 1° Pointers Table")
  firstPointerOffsetLineEdit2.setToolTip("First pointer offset for the first Pointers Table (without 0x).\nIt will be found using the Pointers Table Index.")
  firstPointerOffsetLineEdit2.setEnabled(false)
  firstPointerOffsetLineEdit2.setInlineStyle(`
  width:238px;
  font-size:11px;
  `)

  firstPointerTitleLayout.addWidget(firstPointerOffsetLineEdit2)
  firstPointerTableOffsetLineEdit.setText("0")

  //First String of the first Table Offset--------------------------------------------------------

  const firstStringTitle = new QWidget();

  const firstStringTitleLayout = new FlexLayout();
  firstStringTitle.setLayout(firstStringTitleLayout)
  // createPointersDialogLayout.addWidget(firstStringTitle)

  const firstStringTitleLabel = new QLabel()
  firstStringTitleLabel.setText("1° String Offset *")
  firstStringTitleLabel.setAlignment(132)
  firstStringTitleLabel.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  firstStringTitleLayout.addWidget(firstStringTitleLabel)

  const firstStringOffsetLineEdit2 = new QLineEdit();
  firstStringOffsetLineEdit2.setPlaceholderText("1° String Offset")
  firstStringOffsetLineEdit2.setToolTip("First string offset in the file (without 0x).\nIt will be found using the Pointers Table Index.")
  firstStringOffsetLineEdit2.setEnabled(false)
  firstStringOffsetLineEdit2.setInlineStyle(`
  width:238px;
  font-size:11px;
  `)

  firstStringTitleLayout.addWidget(firstStringOffsetLineEdit2)

  //Post-last string of the last Pointers Table--------------------------------------------------------

  const postLastStringTitle = new QWidget();

  const postLastStringTitleLayout = new FlexLayout();
  postLastStringTitle.setLayout(postLastStringTitleLayout)
  createPointersDialogLayout.addWidget(postLastStringTitle)

  const postLastStringTitleLabel = new QLabel()
  postLastStringTitleLabel.setText("Post-last String Offset *")
  postLastStringTitleLabel.setAlignment(132)
  postLastStringTitleLabel.setInlineStyle(`
  width:238px;
  border-color:black;
  border-style:solid;
  border-bottom-width:1px;
  `)

  postLastStringTitleLayout.addWidget(postLastStringTitleLabel)

  const postLastStringOffsetLineEdit = new QLineEdit();
  postLastStringOffsetLineEdit.setPlaceholderText("Post-last String Offset")
  postLastStringOffsetLineEdit.setToolTip("Post-last String Offset in the file (without 0x).\nIf there are nothing else after the last string\nuse the offset of the last character.")
  postLastStringOffsetLineEdit.setEnabled(true)
  postLastStringOffsetLineEdit.setInlineStyle(`
  width:238px;
  font-size:11px;
  `)

  postLastStringTitleLayout.addWidget(postLastStringOffsetLineEdit)

  //Next Step Button--------------------------------------------------------

  const createPointersTableButton = new QPushButton()

  createPointersTableButton.setText("Next step")
  createPointersTableButton.addEventListener("clicked",function (){

    
    if(firstPointerTableOffsetLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && lastPointerTableOffsetLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
    && pointersTableSectionNameLineEdit.text().match(/^[a-zA-Z0-9 ]+$/) !=null
    && globalOffsetLineEdit.text().match(/^[0-9]+$/)
    && postLastStringOffsetLineEdit.text().match(/^(?:[0-9A-F]{1}|[0-9A-F]{2}|[0-9A-F]{3}|[0-9A-F]{4}|[0-9A-F]{5}|[0-9A-F]{6})$/i) !=null
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
    createPointersDialogStep2.setFixedSize(262,400)
    
    const createPointersDialogStep2Label = new QLabel()
    createPointersDialogStep2Label.setText("Select the pointers of the Index Table")
    
    const createPointersDialogStep2Layout = new QBoxLayout(2)
    createPointersDialogStep2.setLayout(createPointersDialogStep2Layout)

    createPointersDialogStep2.show()

    let k = 0
    let i = 0
    currentContent = fs.readFileSync(`${filePathQLineEditRead.text()}`)
    extractedTablePointersRaw = currentContent.slice(parseInt(firstPointerTableOffsetLineEdit.text(),16),parseInt(lastPointerTableOffsetLineEdit.text(),16))

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
      if(firstPointersTableOffsetLineEdit.text()=== ""){
        win.setFixedSize(728, 544);

        listWidget.setInlineStyle(`
        margin: 2px;
        min-height:440px;
        width:210px;
        flex:1;
      `)
      }

      postLastStringOffset = postLastStringOffsetLineEdit.text()

      firstPointersTableOffsetLineEdit.setText(firstPointerTableOffsetLineEdit.text())
      lastPointersTableOffsetLineEdit.setText(lastPointerTableOffsetLineEdit.text())
      sectionNameLineEdit.setText(pointersTableSectionNameLineEdit.text())

      createPointersTable(pointersTableSectionNameLineEdit.text())
    })
  })

  createPointersDialogLayout.addWidget(createPointersTableButton)

  postLastStringOffsetLineEdit.setText(((fs.readFileSync(`${selectedFile}`)).length-1).toString(16))
  
  //MH2 Preloaded Pointers Tables Configurations
  if(pointersTableSectionNameLineEdit.text()==="armor"){
    lastPointerTableOffsetLineEdit.setText("40")
  }else if(pointersTableSectionNameLineEdit.text()==="bar"){
    lastPointerTableOffsetLineEdit.setText("50")
  }else if(pointersTableSectionNameLineEdit.text()==="bar2"){
    lastPointerTableOffsetLineEdit.setText("70")
  }else if(pointersTableSectionNameLineEdit.text()==="bar3"){
    lastPointerTableOffsetLineEdit.setText("48")
  }else if(pointersTableSectionNameLineEdit.text()==="cocot"){
    lastPointerTableOffsetLineEdit.setText("90")
  }else if(pointersTableSectionNameLineEdit.text()==="mh01"){
    lastPointerTableOffsetLineEdit.setText("78")
  }else if(pointersTableSectionNameLineEdit.text()==="mh02"){
    lastPointerTableOffsetLineEdit.setText("78")
  }else if(pointersTableSectionNameLineEdit.text()==="mh03"){
    lastPointerTableOffsetLineEdit.setText("78")
  }else if(pointersTableSectionNameLineEdit.text()==="mhc"){
    lastPointerTableOffsetLineEdit.setText("28")
  }else if(pointersTableSectionNameLineEdit.text()==="monmae"){
    lastPointerTableOffsetLineEdit.setText("80")
  }else if(pointersTableSectionNameLineEdit.text()==="square"){
    lastPointerTableOffsetLineEdit.setText("58")
  }else if(pointersTableSectionNameLineEdit.text()==="tunnel"){
    lastPointerTableOffsetLineEdit.setText("08")
  }else if(pointersTableSectionNameLineEdit.text()==="village"){
    lastPointerTableOffsetLineEdit.setText("C0")
  }

  //MHP3rd Preloaded Pointers Tables Configurations
  if(pointersTableSectionNameLineEdit.text()==="0017"){
    
    lastPointerTableOffsetLineEdit.setText("CC")
    if(fs.readFileSync(`${selectedFile}`)[parseInt("72BED",16)]===93){
      postLastStringOffsetLineEdit.setText("72BED")
    }else if(fs.readFileSync(`${selectedFile}`)[parseInt("72F37",16)]===93){
      postLastStringOffsetLineEdit.setText("72F37")
    }

  }else if(pointersTableSectionNameLineEdit.text()==="2813"){//nonHD
    lastPointerTableOffsetLineEdit.setText("0C")
    postLastStringOffsetLineEdit.setText("389A")
  }else if(pointersTableSectionNameLineEdit.text()==="2836"){//HD
    lastPointerTableOffsetLineEdit.setText("0C")
    postLastStringOffsetLineEdit.setText("37B4")
  }else if(pointersTableSectionNameLineEdit.text()==="2814"||pointersTableSectionNameLineEdit.text()==="2837"){
    lastPointerTableOffsetLineEdit.setText("0C")
    postLastStringOffsetLineEdit.setText("3014")
  }else if(pointersTableSectionNameLineEdit.text()==="2815"||pointersTableSectionNameLineEdit.text()==="2838"){
    lastPointerTableOffsetLineEdit.setText("0C")
    postLastStringOffsetLineEdit.setText("25B42")
  }else if(pointersTableSectionNameLineEdit.text()==="2816"){//nonHD
    lastPointerTableOffsetLineEdit.setText("24")
    postLastStringOffsetLineEdit.setText("23317")
  }else if(pointersTableSectionNameLineEdit.text()==="2839"){//HD
    lastPointerTableOffsetLineEdit.setText("24")
    postLastStringOffsetLineEdit.setText("232F1")
  }else if(pointersTableSectionNameLineEdit.text()==="2817"||pointersTableSectionNameLineEdit.text()==="2840"){
    lastPointerTableOffsetLineEdit.setText("10")
    postLastStringOffsetLineEdit.setText("5F6B0")
  }else if(pointersTableSectionNameLineEdit.text()==="2818"||pointersTableSectionNameLineEdit.text()==="2841"){
    lastPointerTableOffsetLineEdit.setText("10")
    postLastStringOffsetLineEdit.setText("A913")
  }else if(pointersTableSectionNameLineEdit.text()==="2819"||pointersTableSectionNameLineEdit.text()==="2842"){
    lastPointerTableOffsetLineEdit.setText("0C")
    postLastStringOffsetLineEdit.setText("2645")
  }else if(pointersTableSectionNameLineEdit.text()==="4202"||pointersTableSectionNameLineEdit.text()==="4290"){
    lastPointerTableOffsetLineEdit.setText("88")
    postLastStringOffsetLineEdit.setText("25F3D")
    globalOffsetLineEdit.setText("4")
  }else if(pointersTableSectionNameLineEdit.text()==="4203"||pointersTableSectionNameLineEdit.text()==="4291"){
    lastPointerTableOffsetLineEdit.setText("40")
    postLastStringOffsetLineEdit.setText("117B7")
    globalOffsetLineEdit.setText("4")
  }else if(pointersTableSectionNameLineEdit.text()==="4204"||pointersTableSectionNameLineEdit.text()==="4292"){
    lastPointerTableOffsetLineEdit.setText("20")
    postLastStringOffsetLineEdit.setText("15B92")
    globalOffsetLineEdit.setText("4")
  }

  createPointersDialog.show()
}

//Uses the info gathered by the getPointersTableData() to creates a .pt file
//This file is saved by default in rootFolder/Pointers Tables
async function createPointersTable(name){
  tableStartPointerFileOffsets[0] = (parseInt(firstPointerOffsetLineEdit.text(),16)).toString(16)
  tableEndPointerStartStringFileOffsets[0] = lastPointerOffsetLineEdit.text()
  // tableEndStringFileOffsets[0] = lastStringOffsetLineEdit.text()

  getSectionedCurrentContent()
  if(getOrganizedSectionsData()===1){

    if(csvTranslationMode===true){
      csvTranslationCanceled = true
    }

    removePointersTable()
    return
  }
  getGlobalExtractedStrings()

  if(fs.existsSync("./Pointers Tables/")===false){
    fs.mkdirSync("./Pointers Tables/")
  }

  saveTableConfiguration(name)

  await sleep(200);

  loadPointersTable(`./Pointers Tables/${name + ".pt"}`)
}

//Displays a window to select a .pt file
//Load .pt file and check if the path of the analized file is correct
//Turn Pointers Table Mode to On by enabling and disabling some objects
//Make adjustments to window size
function loadPointersTable(pathToPTFile){

  if(pathToPTFile!=undefined){

    selectedPTFile = path.resolve(pathToPTFile).split(path.sep).join("/");
    sectionNameLineEdit.setText(selectedPTFile.replace(/^.*[\\\/]/, "").replace(".pt",""))
  }else{
    const ptFileDialog = new QFileDialog()
    let goBack = true

    ptFileDialog.addEventListener("fileSelected",function(file){

      if(ptFileDialog.selectedFiles().length!=0&&
        fs.lstatSync(ptFileDialog.selectedFiles()[0]).isDirectory()===false&&
        path.extname(`${ptFileDialog.selectedFiles()[0].toLowerCase()}`)===".pt"){

        
        selectedPTFile = file;
        sectionNameLineEdit.setText(selectedPTFile.replace(/^.*[\\\/]/, "").replace(".pt",""))
        goBack = false
      }else{
        return
      }
    })

    ptFileDialog.setFileMode(1)
    ptFileDialog.setWindowTitle("Choose a .pt file")
    ptFileDialog.setAcceptMode(0)
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

  firstPointerOffsetLineEdit.setReadOnly(true)
  lastPointerOffsetLineEdit.setReadOnly(true)
  firstStringOffsetLineEdit.setReadOnly(true)
  lastStringOffsetLineEdit.setReadOnly(true)
  filePathQLineEditRead.setReadOnly(true)

  sectionNameHeader = sectionNameLineEdit.text()

  pointersTableModeON = true

  if(firstPointersTableOffsetLineEdit.text().length=== 0){
    win.setFixedSize(728, 544);

    listWidget.setInlineStyle(`
    margin: 2px;
    min-height:440px;
    width:210px;
    flex:1;`)
  }
  rezisePointersTableLineEdit()
  sectionNameNumber.setText("1 ")
  initPointersTableMode = true
  loadPTConfiguration()
}

//Load and set all the data from the .pt file
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

      tableStartPointerFileOffsets[k] = pointersTableModeSettingsArr[i]
      tableEndPointerStartStringFileOffsets[k] = pointersTableModeSettingsArr[i+1]
      tableEndStringFileOffsets[k] = pointersTableModeSettingsArr[i+2]
      i=i+5
      k=k+1
    }
    postLastStringOffset = tableEndStringFileOffsets[k-1]
    globalOffset = Number(pointersTableModeSettingsArr[11])

    getSectionedCurrentContent()
    if(getOrganizedSectionsData()===1){

      if(csvTranslationMode===true){
        csvTranslationCanceled = true
      }

      removePointersTable()
      return
    }
    getGlobalExtractedStrings()

    //tablePointersIndexPositions = mapPointersPositions(currentContent,parseInt(pointersTableModeSettingsArr[4],16),parseInt(pointersTableModeSettingsArr[5],16))

    sectionNameLineEdit.setReadOnly(true)

    firstPointersTableOffsetLineEdit.setText(pointersTableModeSettingsArr[4])
    lastPointersTableOffsetLineEdit.setText(pointersTableModeSettingsArr[5])
    firstPointerOffsetLineEdit.setText((parseInt(tableStartPointerFileOffsets[Number(sectionNameNumber.text())-1],16)+globalOffset).toString(16).toUpperCase())
    lastPointerOffsetLineEdit.setText(tableEndPointerStartStringFileOffsets[Number(sectionNameNumber.text())-1])
    firstStringOffsetLineEdit.setText(tableEndPointerStartStringFileOffsets[Number(sectionNameNumber.text())-1])
    lastStringOffsetLineEdit.setText(tableEndStringFileOffsets[Number(sectionNameNumber.text())-1])
    
 
    extractedTablePointersRaw = currentContent.slice(parseInt(firstPointersTableOffsetLineEdit.text(),16),parseInt(lastPointersTableOffsetLineEdit.text(),16))
    
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

    saveAndPrepare(pointersTableModeON)

  }
}


//Maps unique pointer offsets within a specified range, using incremental 
//search to prevent collisions between identical pointer values.
function mapPointersPositions(buffer,start,end) {
  let pointerOffsets = [];
  let searchOffset = start;
  const tableEnd = end;

  selectedTablePointers.forEach(hexValue => {
    const targetBuffer = Buffer.from(hexValue, 'hex');
    
    const foundAt = buffer.indexOf(targetBuffer, searchOffset);

    if (foundAt !== -1 && foundAt < tableEnd) {
      pointerOffsets.push(foundAt);
      searchOffset = foundAt + 4; 
    } else {
      console.error("Pointer cannot be mapped", hexValue);
    }
  });

  return pointerOffsets;
}

//Uses the selected table pointers from the .pt file to get the parts or sections that made the
//analized file. This goes from the first pointer until the first pointer of the next section
function getSectionedCurrentContent(){
  let i = 0
  sectionedCurrentContent = []
  
  while(selectedTablePointers.length>i){

    if(selectedTablePointers.length-1!=i){
      let firstPointerOffset1
      let firstPointerOffset2

      if(bigEndian.isChecked()===false){
        firstPointerOffset1 = Buffer.from(selectedTablePointers[i], "hex").readUIntLE(0,4)
        firstPointerOffset2 = Buffer.from(selectedTablePointers[i+1], "hex").readUIntLE(0,4)
  
        sectionedCurrentContent[i] = currentContent.slice(firstPointerOffset1,firstPointerOffset2)
  
      }else{
        firstPointerOffset1 = Buffer.from(selectedTablePointers[i], "hex").readUIntBE(0,4)
        firstPointerOffset2 = Buffer.from(selectedTablePointers[i+1], "hex").readUIntBE(0,4)
  
        sectionedCurrentContent[i] = currentContent.slice(firstPointerOffset1,firstPointerOffset2)
  
      }
    }else{
      sectionedCurrentContent[i] = currentContent.slice(Buffer.from(selectedTablePointers[i], "hex").readUIntLE(0,Buffer.from(selectedTablePointers[i], "hex").length),-1)

      break
    }
    i=i+1
  }
}

//Uses the data from getSectionedCurrentContent() to get their pointers and string offsets
function getOrganizedSectionsData() {
  const isBigEndian = bigEndian.isChecked();
  const isFileSizeMenuAction1 = fileSizeMenuAction1.isChecked();
  const isFileSizeMenuAction2 = fileSizeMenuAction2NoKeepSize.isChecked();
  const selectedPointers = selectedTablePointers;
  let i = 0;

  while (selectedPointers[i] !== undefined) {
    try {
      //Pre-calculate frequently used values
      const currentPointerHex = selectedPointers[i];
      const currentPointerBuffer = Buffer.from(currentPointerHex, "hex");
      const readMethod = isBigEndian ? 'readUIntBE' : 'readUIntLE';
      
      //Process pointer offsets
      tableStartPointerFileOffsets[i] = (currentPointerBuffer[readMethod](0, currentPointerBuffer.length).toString(16));
      
      //Process offset
      const offsetBuffer = Buffer.from(sectionedCurrentContent[i].slice(0 + globalOffset, 4 + globalOffset));
      const offset = offsetBuffer[readMethod](0, 4);
      tableEndPointerStartStringFileOffsets[i] = (offset + parseInt(tableStartPointerFileOffsets[i], 16)).toString(16).toUpperCase();

      //Process end string offsets
      if (selectedPointers[i + 1] !== undefined) {
        const nextPointerBuffer = Buffer.from(selectedPointers[i + 1], "hex");
        tableEndStringFileOffsets[i] = nextPointerBuffer[readMethod](0, nextPointerBuffer.length).toString(16).toUpperCase();
      } else {
        if (isFileSizeMenuAction1 || savedString === "") {
          tableEndStringFileOffsets[i] = postLastStringOffset;
        } else if (isFileSizeMenuAction2) {
          const sizeDiff = currentContent.length - oldcurrentContentLength;
          tableEndStringFileOffsets[i] = (parseInt(postLastStringOffset, 16) + sizeDiff).toString(16);
          postLastStringOffset = tableEndStringFileOffsets[i];
        }
      }

      //Validate offset
      if (currentContent[parseInt(tableEndPointerStartStringFileOffsets[i], 16)] === undefined) {
        errorMessageBox.setWindowTitle("Error");
        errorMessageBox.setText(`ERROR! The starting string offset (${tableEndPointerStartStringFileOffsets[i]})\npoints to a value that do not exist, returning\nto default state to prevent the corruption of the\n.pt file. If using the same .pt doesn't work please\ncreate a new Pointers Table for this file.`);
        errorMessageButton.setText("                                                Ok                                              ");
        errorMessageBox.exec();
        return 1;
      }
      
      if (parseInt(tableEndPointerStartStringFileOffsets[i],16)>parseInt(tableEndStringFileOffsets[i],16)) {
        errorMessageBox.setWindowTitle("Error");
        errorMessageBox.setText(`ERROR! The starting string offset (${tableEndPointerStartStringFileOffsets[i]})\n is bigger than the ending one (${tableEndStringFileOffsets[i]}), returning\nto default state to prevent the corruption of the\n.pt file. If using the same .pt doesn't work please\ncreate a new Pointers Table for this file.`);
        errorMessageButton.setText("                                                Ok                                              ");
        errorMessageBox.exec();
        return 1;
      }

      // Build organized section
      organizedSections[i] = `${i + 1}\n` +
      tableStartPointerFileOffsets[i] + "\n" +
      tableEndPointerStartStringFileOffsets[i] + "\n" +
      tableEndStringFileOffsets[i] + "\n";

      i++;
    }catch(error){
      errorMessageBox.setWindowTitle("Error");
      errorMessageBox.setText(`Error processing pointer at index, ${i}\nmaybe the file has been already changed\nor this is a bug.`);
      errorMessageButton.setText("                                                Ok                                              ");
      errorMessageBox.exec();
      console.error("Error processing pointer at index", i, ":", error);
      return 1;
    }
  }
  sectionedCurrentContentLength = sectionedCurrentContent.length-1
  if(!sectionChangeInProcess) getStringsAndPointersMasterDataObj()
}


//Optimized extraction and mapping of pointer pairs and their corresponding strings 
//from sectioned content, validating bounds, eliminating duplicates via a Set, 
//and calculating absolute positions based on the configured Endianness
function getStringsAndPointersMasterDataObj() {
  tableModeMasterDataObj = new Array(sectionedCurrentContent.length).fill().map(() => []);

  for (let i = 0; i < sectionedCurrentContent.length; i++) {
    const section = sectionedCurrentContent[i];
    const seenPointers = new Set();

    const basePtrHex = selectedTablePointers[i];
    const basePtrBuf = Buffer.from(basePtrHex, "hex");
    const basePtrVal = bigEndian.isChecked() ? basePtrBuf.readUint32BE(0) : basePtrBuf.readUint32LE(0);

    for (let k = 0; k * 4 + 4 <= section.length; k++) {
      const pointerBuffer = section.subarray(k * 4, k * 4 + 4);
      const pointerDecimals = bigEndian.isChecked() ? pointerBuffer.readUInt32BE(0) : pointerBuffer.readUInt32LE(0);

      if (pointerDecimals > currentContent.length) break;

      const ptrHex = pointerBuffer.toString('hex');
      if (seenPointers.has(ptrHex)) continue;
      seenPointers.add(ptrHex);

      let endOfString = section.indexOf(0, pointerDecimals);
      if (endOfString === -1) endOfString = section.length; 

      tableModeMasterDataObj[i].push({
        stringBuffer: section.subarray(pointerDecimals, endOfString),
        stringPosition: basePtrVal + pointerDecimals,
        pointerBuffer: pointerBuffer,
        pointerPosition: basePtrVal + (k * 4),
      });
    }
  }
  oldTableModeMasterDataObj = structuredClone(tableModeMasterDataObj);
}

//globalExtractedStrings and globalOffsetOfEachString are needed to calculate
//accurately the space left when table pointers mode is ON
function getGlobalExtractedStrings(){
  globalOffsetOfEachString = []
  let i = 0
  let oldOffsets = offsetOfEachString
  while(tableEndPointerStartStringFileOffsets[i]!=undefined){

    globalExtractedStrings[i] = currentContent.slice(parseInt(tableEndPointerStartStringFileOffsets[i],16),parseInt(tableEndStringFileOffsets[i],16))
    globalOffsetOfEachString[i] = stringOffsetFuncWithoutPointers(currentContent,parseInt(tableEndPointerStartStringFileOffsets[i],16),parseInt(tableEndStringFileOffsets[i],16))

    i =i+1
  }
  offsetOfEachString = oldOffsets
}

//Saves .pt file data
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
${firstPointersTableOffsetLineEdit.text()}
${lastPointersTableOffsetLineEdit.text()}

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

//Similar to setDefaultValues(), removes all the special configurations from the pointers table mode.
function removePointersTable(){
  saveSettingsButton.setEnabled(true)
  saveSettingsButton2.setEnabled(true)
  sectionNameLineEdit.setReadOnly(false)
  firstPointerOffsetLineEdit.setReadOnly(false)
  lastPointerOffsetLineEdit.setReadOnly(false)
  firstStringOffsetLineEdit.setReadOnly(false)
  lastStringOffsetLineEdit.setReadOnly(false)
  filePathQLineEditRead.setReadOnly(false)
  firstPointersTableOffsetLineEdit.setText("")
  lastPointersTableOffsetLineEdit.setText("")
  fileSizeMenu.setTitle("File Size: Keep")
  sectionDetailsLabel.setText(`Section name: String#N/A`)
  mainMenuAction1.setText("Load file")
  mainMenuAction3.setEnabled(true)
  fileSizeMenu.setEnabled(false)
  fileSizeMenuAction1.setChecked(true)
  fileSizeMenuAction1.setEnabled(false)
  fileSizeMenuAction2NoKeepSize.setChecked(false)
  fileSizeMenuAction2NoKeepSize.setEnabled(true)

  globalExtractedStrings = []

  sectionNameHeader = "Section name"
  pointersTableModeON = false
  
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

//Updates .pt file with new values
function pointersTableUpdater(){
  let i = 0
  //For the pointers table mode.

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

    while(sectionedCurrentContent[i] != undefined) {
      let tempBuf = Buffer.alloc(4);
      let finalValue;

      if(bigEndian.isChecked()) {
        finalValue = Buffer.from(selectedTablePointers[i], "hex").readIntBE(0, 4) + stringsOffset;
        tempBuf.writeUIntBE(finalValue, 0, 4);
      }else{
        finalValue = Buffer.from(selectedTablePointers[i], "hex").readIntLE(0, 4) + stringsOffset;
        tempBuf.writeUIntLE(finalValue, 0, 4);
      }
      selectedTablePointers[i] = tempBuf.toString("hex").toUpperCase();
      i=i+1;
    }

    i = 0;
    while(selectedTablePointers[i] != undefined) {
      if(selectedTablePointers[i].toUpperCase() !== oldSelectedTablePointers[i].toUpperCase()) {  
        let targetIndex = (i*2)+1;

        if(extractedTablePointersIn4[targetIndex] != undefined) {
          extractedTablePointersIn4[targetIndex] = Buffer.from(selectedTablePointers[i], "hex");
        }
      }
      i++;
    }
  
    i = 0
    while(oldSelectedTablePointers[i]!=undefined){
      oldSelectedTablePointers[i] = selectedTablePointers[i]
      i=i+1
    } 
    i = 0

    const start = parseInt(firstPointersTableOffsetLineEdit.text(), 16);
    const end = parseInt(lastPointersTableOffsetLineEdit.text(), 16);
    const extractedTablePointers = Buffer.concat(extractedTablePointersIn4);

    currentContent = Buffer.concat([
      currentContent.subarray(0, start),
      extractedTablePointers,
      currentContent.subarray(end)
    ]);

    originalExtractedStringsLength = currentContent.slice(firstStringOffsetInDecimal, parseInt(lastStringOffsetLineEdit.text(),16)).length
  
  getSectionedCurrentContent()
  if(getOrganizedSectionsData()===1){

    if(csvTranslationMode===true){
      csvTranslationCanceled = true
    }
    
    removePointersTable()
    return
  }
  getGlobalExtractedStrings()

  if(csvInfoGatheringMode===false||csvTranslationMode===true){
    saveTableConfiguration()
  }
}

//Manages when the Shift-JIS encoding is selected.
function setShiftJISEncoding(force){
  if(encodingMenuAction2.isChecked()===true||force){
    encodingMenuAction1.setChecked(false)
    encodingMenuAction1.setEnabled(true)
    encodingMenuAction2.setEnabled(false)
    encodingMenu.setTitle("Encoding: Shift-JIS")
    UTF8Encoding = false
    shiftJISEncoding = true

    if(hexViewBuffer&&currentEncoding==="UTF8"){
      setShiftJISEncodingAndRender()
    }
  }

  if(listWidget.count()!=0 && extractedPointersIn4[0]!= undefined){
    console.log("Changing encoding to Shift-JIS 1")
    saveAndPrepare(true)
  }else if(listWidget.count()!=0 && extractedPointersIn4[0]=== undefined){
    console.log("Changing encoding to Shift-JIS 2")
    saveAndPreparePointerless(true)
  }
}

//Manages when the UTF8 encoding is selected.
function setUTF8Encoding(force){
  if(encodingMenuAction1.isChecked()===true||force){
    encodingMenuAction2.setChecked(false)
    encodingMenuAction2.setEnabled(true)
    encodingMenuAction1.setEnabled(false)
    encodingMenu.setTitle("Encoding: UTF-8")
    UTF8Encoding = true
    shiftJISEncoding = false
    if(hexViewBuffer&&currentEncoding==="SJIS"){
      setUTF8EncodingAndRender()
    }
  }
  if(listWidget.count()!=0 && extractedPointersIn4[0]!= undefined){
    console.log("Changing encoding to UTF-8 1")
    mibListObjsData.length>0?saveAndPrepare(false):saveAndPrepare(true)
  }else if(listWidget.count()!=0 && extractedPointersIn4[0]=== undefined){
    console.log("Changing encoding to UTF-8 2")
    mibListObjsData.length>0?saveAndPreparePointerless(false):saveAndPreparePointerless(true)
  }
}

//Manages the file size when a bigger string is overwritten.
function fileSize(options){
  
  if(options===0){

    if(fileSizeMenuAction1.isChecked()===true){
      fileSizeMenuAction2NoKeepSize.setChecked(false)
      fileSizeMenuAction2NoKeepSize.setEnabled(true)
      fileSizeMenuAction1.setEnabled(false)
      fileSizeMenu.setTitle("File Size: Keep")
    }
  }else{

    if(fileSizeMenuAction2NoKeepSize.isChecked()===true){
      fileSizeMenuAction1.setChecked(false)
      fileSizeMenuAction1.setEnabled(true)
      fileSizeMenuAction2NoKeepSize.setEnabled(false)
      fileSizeMenu.setTitle("File Size: Don't keep")
    }
  }
}

//Align the strings of two csv side by side. Both must be separated by semicolons and
//each string must be separated from another one by a new line.
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
    i = 0
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

//If the button is still being pressed, plus1() and minus1() will keep triggering.
function sectionNameButtonIsBeingPressed(options) {

  if(options===0){
    clearInterval(timer);
    timer = setInterval(function() {
      if(sectionNameUpButton.isDown()===true){
        plus1(pointersTableModeON)
      }else{
        plus1(pointersTableModeON)
        clearInterval(this)
      }
    }, 100)
  }else{
    clearInterval(timer);
    timer = setInterval(function() {
      if(sectionNameDownButton.isDown()===true){
        minus1(pointersTableModeON)
      }else{
        minus1(pointersTableModeON)
        clearInterval(this)
      }
    }, 100)
  }
}

/**
 * Loads a .mib file configuration data needed to get their strings.
 * 
 * Handles three scenarios:
 * 1. Configuration with pointers: Loads file, offsets, then runs start() and saveAndPrepare()
 * 2. Configuration without pointers: Same but uses saveAndPreparePointerless()
 * 3. Invalid position: Decrements section counter and stops info gathering if active
 * 
 * @param {number} arrPosition - Position in mibListObjsData array (1-based index)
 * @returns {void}
 */
function loadMibConfiguration(arrPosition){

  if(mibListObjsData[arrPosition-1]&& mibListObjsData[arrPosition-1].offset.firstPointer){

    filePathQLineEditRead.setText(`${mibListObjsData[arrPosition-1].path}`)
    sectionNameLineEdit.setText(mibListObjsData[arrPosition-1].name)
    selectedFile = filePathQLineEditRead.text()

    firstStringOffsetLineEdit.setText(mibListObjsData[arrPosition-1].offset.firstString)
    lastStringOffsetLineEdit.setText(mibListObjsData[arrPosition-1].offset.lastString)
    firstPointerOffsetLineEdit.setText(mibListObjsData[arrPosition-1].offset.firstPointer)
    lastPointerOffsetLineEdit.setText(mibListObjsData[arrPosition-1].offset.lastPointer)

    start()
    saveAndPrepare(false)
  }else if(mibListObjsData[arrPosition-1]&& mibListObjsData[arrPosition-1].offset.firstString){

    filePathQLineEditRead.setText(`${mibListObjsData[arrPosition-1].path}`)
    sectionNameLineEdit.setText(mibListObjsData[arrPosition-1].name)
    selectedFile = filePathQLineEditRead.text()

    firstStringOffsetLineEdit.setText(mibListObjsData[arrPosition-1].offset.firstString)
    lastStringOffsetLineEdit.setText(mibListObjsData[arrPosition-1].offset.lastString)
    firstPointerOffsetLineEdit.setText(mibListObjsData[arrPosition-1].offset.firstPointer)
    lastPointerOffsetLineEdit.setText(mibListObjsData[arrPosition-1].offset.lastPointer)

    start()
    saveAndPreparePointerless(false)
  }else{
    if(csvInfoGatheringMode===true){
      stopCsvInfoGatheringMode = true
    }
    sectionNameNumber.setText(`${Number(sectionNameNumber.text())-1}` + " ")
  }
}

function containsOnlyNull(buffer) {
  return buffer.every(byte => byte === 0);
}

//Returns a Buffer if is not a string Pointer, contrary case, returns true
function checkIfIsStringPointer(positionToLook,buffer,firstStringPosition,initialPosition,offset = 0){
  const mainBufferLength = buffer.length

  if(!firstStringPosition){
    firstStringPosition =0  
  }
  const positionToLookSlice = buffer.subarray(positionToLook, positionToLook + 4);
  const posibleStringPosition = positionToLookSlice.readUInt32LE(0) +offset
  const currentSlice = buffer.subarray(posibleStringPosition, posibleStringPosition + 4);

  if(!containsOnlyNull(currentSlice)
  &&posibleStringPosition>initialPosition
  &&posibleStringPosition>firstStringPosition
  &&currentSlice.readUInt32LE(0)>mainBufferLength
  &&currentSlice.readUInt32BE(0)>mainBufferLength){
    return true
  }else{
    return posibleStringPosition
  }
}

//Checks if a number is divisible by another
function isMultiple(number, divider) {

  if (number % divider === 0) {
    return true; // is multiple
  } else {
    return false; // is not multiple
  }
}

/**
 * Scans a buffer starting from a given position to find all pointer offset
 * and their corresponding string offsets.
 * 
 * The function works in two phases:
 * 1. Locates the first valid string pointer by scanning forward
 * 2. Then finds all subsequent pointers in the table
 * 
 * Also calculates the post-last string offset, ensuring 4-byte alignment.
 * 
 * @param {Buffer} buffer - The file buffer to scan
 * @param {number} positionToStartSearch - Starting offset in the buffer
 * @param {number} offset - Optional offset to add to pointer values (default: 0)
 * @param {number} phase - Adjusts pointer positioning (0 or 1 typically)
 * @returns {Array} [allStringsOffset, allPointersOffset] - Arrays of hex offsets
 */
function getOffsetsForMib(buffer, positionToStartSearch,offset = 0,phase = 0){

  const pointers = [];

  let foundStringPointersSet
  let currentPositionInTest = positionToStartSearch+ offset
  const initialPosition = currentPositionInTest
  let isStartPhase = true
  while(!foundStringPointersSet){

    const pointerOrString = checkIfIsStringPointer(currentPositionInTest,buffer,undefined,initialPosition,offset)
    if(pointerOrString!==true){

      if(isStartPhase){
        currentPositionInTest = pointerOrString + phase*4
        isStartPhase=false
      }else{
        currentPositionInTest = pointerOrString
      }
      
    }else{
      let k = 0
      while (true) {
        const start = currentPositionInTest + (k * 4); //Pointer size is 4

        let firstPointerStringPosition
        if(pointers[0]){
          firstPointerStringPosition = buffer.subarray(pointers[0], pointers[0] + 4).readUInt32LE(0)
        }
        if (checkIfIsStringPointer(start,buffer,firstPointerStringPosition,initialPosition,offset)!==true){
          //PostLastPointer
            pointers.push(start)
          break
        }
        
        pointers.push(start);
        k++;
      }
      foundStringPointersSet = true
    }
  }

  const allPointerOffsets = new Array(pointers.length);
  const allStringsOffsets = new Array(pointers.length);
  
  for (let i = 0; i < pointers.length; i++) {
    allPointerOffsets[i] = pointers[i].toString(16).toUpperCase();

    if(i<pointers.length-1){
      allStringsOffsets[i] = (buffer.subarray(pointers[i], pointers[i] + 4).readUInt32LE(0)+offset).toString(16).toUpperCase()
    }
  }

  let nextNonZeroByte = parseInt(allStringsOffsets[allStringsOffsets.length-2],16)
  while (nextNonZeroByte < buffer.length && buffer[nextNonZeroByte] !== 0) {
    nextNonZeroByte++;
  }

  while (nextNonZeroByte <= buffer.length && buffer[nextNonZeroByte] === 0) {
    nextNonZeroByte++;
  }
  let postLastString
  if(buffer.length===nextNonZeroByte){
    postLastString = (nextNonZeroByte-1).toString(16).toUpperCase().padStart(pointers[0].length, '0').toUpperCase();
  }else{

    if(isMultiple(nextNonZeroByte,4)||buffer[nextNonZeroByte]!==0){
      postLastString = nextNonZeroByte.toString(16).toUpperCase().padStart(pointers[0].length, '0').toUpperCase();
    }else{
      while(!isMultiple(nextNonZeroByte,4)){
        nextNonZeroByte--;
      }
      postLastString = nextNonZeroByte.toString(16).toUpperCase().padStart(pointers[0].length, '0').toUpperCase();
    }
  }
  
  allStringsOffsets[allStringsOffsets.length-1] = postLastString
  
  return [allStringsOffsets, allPointerOffsets];
}

function tryToOptimizeTheSpaceForMibs(allStringsOffsets, allpointersOffsets, buffer) {

  //Update all pointers data and strings position but the last one
  for(let i = 0;allStringsOffsets[i+1];i++){
    const stringPos = parseInt(allStringsOffsets[i], 16);
    const pointerPos = parseInt(allpointersOffsets[i], 16);

    //String limits
    let start = stringPos;
    while (start > 0 && buffer[start - 1] === 0) start--;
    
    let end = stringPos;
    while (end < buffer.length && buffer[end] !== 0) end++;

    //Move string
    const targetPos = start + 1;
    const stringContent = Buffer.from(buffer.subarray(stringPos, end));
    buffer.fill(0, stringPos, end);
    stringContent.copy(buffer, targetPos);

    //Update pointer
    const pointerBuffer = Buffer.alloc(4);
    pointerBuffer.writeUInt32LE(targetPos);
    pointerBuffer.copy(buffer, pointerPos);

    allStringsOffsets[i] = targetPos.toString(16).padStart(allStringsOffsets[i].length, '0').toUpperCase();
  }
  return [allStringsOffsets,buffer];
}

//Returns false if the file header matches known Monster Hunter unencrypted signatures,
//true otherwise (indicating probable encryption). Checks multiple offsets and patterns.
function checkEncryption(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('48000000', 'hex')) //MHG
  ||buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('40000000', 'hex')) //MH1
  ||buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('74000000', 'hex')) //MH2
  ||buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('3C000000', 'hex')) //MHP1
  ||buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('4D485032', 'hex')) //MHP2
  ||buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('4C000000', 'hex')) //MHP2ndG
  ||buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('94000000', 'hex')) //MHP3RD
  ||buffer.length >= 4 && buffer.subarray(32, 36).equals(Buffer.from('94000000', 'hex'))
  ||buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from('4F4D4F4D', 'hex'))){ //MHP3RD
  
    return false;
  }else{
    return true
  }
}

/**
 * Opens a folder dialog, processes all .mib/.bin files found, and loads them into memory.
 * 
 * WORKFLOW:
 * 1. User selects folder containing .mib/.bin files
 * 2. Files are filtered to exclude encrypted ones (using checkEncryption)
 * 3. UI switches to .mib mode (read-only fields, disabled buttons, adds "Leave Mib mode" menu)
 * 4. Each file is processed based on its game type (MH1, MHP1, MHP2, MHP3, MHTri, etc.)
 * 5. For each file, extracts pointer tables and string offsets using game-specific offsets
 * 6. Some files may generate multiple configurations (e.g., MH1 generates two)
 * 7. After processing, loads the first configuration and displays it
 * 
 * GAME-SPECIFIC HANDLING:
 * - MH1/MH2/MHG: Two pointer tables (positions 96 and 48), may need space optimization
 * - MHP1/MHP2/MHP3: Multiple tables (up to 7), different start positions per game
 * - MHTri: Uses OMOM header, reads pointer count from offset 4
 * 
 * Also handles encoding (Shift-JIS or UTF-8) based on game/region.
 * 
 * @returns {Promise<void>}
 */
async function openAndProcessAllMibs(){

  let mibList

  const chooseFolderDialog = new QFileDialog();
  chooseFolderDialog.setFileMode(2)
  chooseFolderDialog.setOption(1,true)
  chooseFolderDialog.setWindowTitle("Select the folder where the .mib files are located")
  chooseFolderDialog.addEventListener("fileSelected",async function(selection){

    mibList = (await fs.promises.readdir(selection)).filter(file => file.endsWith('.mib.unpacked')||file.endsWith('.mib')||file.endsWith('.bin'));

    mibList = mibList.filter((fileName,index)=>{

      const isEncrypted = checkEncryption(selection+"/"+fileName)

      if(!isEncrypted){return fileName}
    })

    setDefaultValues()
    
    mibListObjsData.length=0

    sectionNameLineEdit.setReadOnly(true)
    lastPointerOffsetLineEdit.setReadOnly(true)
    firstPointerOffsetLineEdit.setReadOnly(true)
    firstStringOffsetLineEdit.setReadOnly(true)
    lastStringOffsetLineEdit.setReadOnly(true)

    saveSettingsButton.setDisabled(true)
    saveSettingsButton2.setDisabled(true)
    bigEndian.setCheckable(false)
    mainMenuAction1.setEnabled(false)
    mainMenuAction2.setEnabled(false)
    mainMenuAction4.setEnabled(false)

    const mainMenuLeaveMibAction = new QAction();
    mainMenuLeaveMibAction.setText('Leave Mib mode');

    const listenerHandler = function () {shutdownMibMode()}

    mainMenuLeaveMibAction.addEventListener("triggered",listenerHandler)
    menuBar.addAction(mainMenuLeaveMibAction)
    
    function shutdownMibMode(){
      menuBar.removeAction(mainMenuLeaveMibAction)
      mainMenuLeaveMibAction.removeEventListener("triggered",listenerHandler)
      mainMenuLeaveMibAction.delete()
      mibListObjsData.length=0

      sectionNameLineEdit.setReadOnly(false)
      lastPointerOffsetLineEdit.setReadOnly(false)
      firstPointerOffsetLineEdit.setReadOnly(false)
      firstStringOffsetLineEdit.setReadOnly(false)
      lastStringOffsetLineEdit.setReadOnly(false)

      saveSettingsButton.setDisabled(false)
      saveSettingsButton2.setDisabled(false)
      bigEndian.setCheckable(true)
      mainMenuAction1.setEnabled(true)
      mainMenuAction2.setEnabled(true)
      mainMenuAction4.setEnabled(true)

      setDefaultValues()
      loadConfiguration()
      goToFirstSection()
    }


    mibList.forEach((mib,index)=>{

      let mibName = mibList[index].replaceAll(".mib.unpacked","")
      mibName = mibName.replaceAll(".mib","")

      const mibPath = selection+"/"+mibList[index]
      const mibFileBuffer = fs.readFileSync(mibPath);
      const mibFilebufferHeader = mibFileBuffer.subarray(0, 4)

      if(mibFilebufferHeader.equals(Buffer.from('48000000', 'hex'))//MHG
      ||mibFilebufferHeader.equals(Buffer.from('74000000', 'hex'))//MH2
      ||(mibFilebufferHeader.equals(Buffer.from('40000000', 'hex')//MH1 (JP,US,EU)
      ))){
    
        const newMibObj = {
          offset:{
            firstString:"",
            lastString:"",
            firstPointer:"",
            lastPointer:""
          },
          name:mibName+"-1",
          origin:"MH1J/MH1USA/MH1EUR/MHGPS2/MHGWii",
          path:mibPath
        }

        const bufferEurOrDosChecker = mibFileBuffer.subarray(96, 100)
        const isEur = bufferEurOrDosChecker.readUIntLE(0,Buffer.from(bufferEurOrDosChecker).length)>65535

        if(isEur){
          setUTF8Encoding(true)
        }else{
          setShiftJISEncoding(true)
        }

        const isDos = bufferEurOrDosChecker.readUIntLE(0,Buffer.from(bufferEurOrDosChecker).length)===0
        let allStrings, allPointers = []

        if(!isEur&!isDos){
          [allStrings,allPointers] = getOffsetsForMib(mibFileBuffer,96)
        }else if(isEur){
          [allStrings,allPointers] = getOffsetsForMib(mibFileBuffer,88)
        }else{
          [allStrings,allPointers] = getOffsetsForMib(mibFileBuffer,152)
        }
        
        newMibObj.offset.lastString = allStrings[allStrings.length-1]
        newMibObj.offset.firstString = allStrings[0]
        newMibObj.offset.lastPointer = allPointers[allPointers.length-1]
        newMibObj.offset.firstPointer = allPointers[0]

        const newMibObj2 = {
          offset:{
            firstString:"",
            lastString:"",
            firstPointer:"",
            lastPointer:""
          },
          name:mibName+"-2",
          origin:"MH1J/MH1USA/MH1EUR/MHGPS2/MHGWii",
          path:mibPath
        }

        const [allStrings2,allPointers2] = getOffsetsForMib(mibFileBuffer,48)
        let newAllStrings,newBuffer
        
        if(mibFilebufferHeader.equals(Buffer.from('48000000', 'hex'))){
          [newAllStrings,newBuffer] = tryToOptimizeTheSpaceForMibs(allStrings2,allPointers2,mibFileBuffer)
        }

        const stringsToUse = newAllStrings || allStrings2;
        const bufferToWrite = newAllStrings ? newBuffer : mibFileBuffer;

        try {
          fs.writeFileSync(`${mibPath}`, bufferToWrite, {
            encoding: "binary",
            flag: "w",
            mode: 0o666
          });
          console.log("File written successfully\n");
        } catch (err) {
          errorMessageBox.setWindowTitle("Error");
          errorMessageBox.setText("ERROR! maybe the file is being used?");
          errorMessageButton.setText("                                                Ok                                              ");
          errorMessageBox.exec();
        }

        newMibObj2.offset.lastString = stringsToUse[stringsToUse.length-1];
        newMibObj2.offset.firstString = stringsToUse[0];

        newMibObj2.offset.lastPointer = allPointers2[allPointers2.length-1]
        newMibObj2.offset.firstPointer = allPointers2[0]

        mibListObjsData.push(newMibObj)
        mibListObjsData.push(newMibObj2)
      }else if(mibFilebufferHeader.equals(Buffer.from('3C000000', 'hex'))||//MHP1 (JP-KR-US-EU)
      mibFilebufferHeader.equals(Buffer.from('4D485032', 'hex'))||//MHP2 (JP-USA-EU)
      mibFilebufferHeader.equals(Buffer.from('4C000000', 'hex'))||//MHP2G (JP-USA-EU)
      mibFilebufferHeader.equals(Buffer.from('94000000', 'hex'))||//MHP3RD (JP-USA-EU)
      mibFilebufferHeader.readUInt32BE(0)>16843009&&mibFileBuffer.subarray(32, 36).equals(Buffer.from('94000000', 'hex'))){//MHP3RD
        
        for(let i = 0;i<=6;i++){
          const newMibObj = {
            offset:{
              firstString:"",
              lastString:"",
              firstPointer:"",
              lastPointer:""
            },
            name:mibName+"-1",
            origin:"MHP1/MHP2/MHP2NDG/MHP3RD and international variants",
            path:mibPath
          }

          const mhChecker = mibFileBuffer.subarray(0, 4)

          const isP1 = mhChecker.equals(Buffer.from('3C000000', 'hex'))
          const isP3NoOffset = mhChecker.equals(Buffer.from('94000000', 'hex'))
          const isP3 = (mhChecker.readUInt32BE(0)>16843009&&mibFileBuffer.subarray(32, 36).equals(Buffer.from('94000000', 'hex')))

          let startPosition1
          let startPosition2
          let offset
          if(isP1){
            startPosition1 = 84
            startPosition2 = 36
          }else if(isP3||isP3NoOffset){
            startPosition1 = 172
            if(!isP3NoOffset){
              offset = 32
            }
          }else{//MHP2 and 2ndG
            startPosition1 = 96
          }

          const [allStrings,allPointers] = getOffsetsForMib(mibFileBuffer,startPosition1,offset,i)
          
          newMibObj.offset.lastString = allStrings[allStrings.length-1]
          newMibObj.offset.firstString = allStrings[0]
          newMibObj.offset.lastPointer = allPointers[allPointers.length-1]
          newMibObj.offset.firstPointer = allPointers[0]

          if(startPosition2){

            const newMibObj2 = {
              offset:{
                firstString:"",
                lastString:"",
                firstPointer:"",
                lastPointer:""
              },
              name:mibName+"-2",
              origin:"MHP1/MHP2/MHP2NDG/MHP3RD and international variants",
              path:mibPath
            }
          
            const [allStrings2,allPointers2] = getOffsetsForMib(mibFileBuffer,startPosition2,undefined,i)
      
            newMibObj2.offset.lastString = allStrings2[allStrings2.length-1]
            newMibObj2.offset.firstString = allStrings2[0]
            newMibObj2.offset.lastPointer = allPointers2[allPointers2.length-1]
            newMibObj2.offset.firstPointer = allPointers2[0]

            if(mibListObjsData[0]&&mibListObjsData[0].offset.firstString===newMibObj.offset.firstString) continue

            if(isP1&&i===0){
              setShiftJISEncoding(true)
            }else{
              setUTF8Encoding(true)
            }

            mibListObjsData.push(newMibObj)
            mibListObjsData.push(newMibObj2)
          }else{

            if(isP1&&i===0){
              setShiftJISEncoding(true)
            }else{
              setUTF8Encoding(true)
            }

            if(mibListObjsData[0]&&mibListObjsData[0].offset.firstString===newMibObj.offset.firstString) continue
            mibListObjsData.push(newMibObj)
          }
        }
      }else if(mibFilebufferHeader.equals(Buffer.from('4F4D4F4D', 'hex'))){//MHTri
        bigEndian.setEnabled(true)

        const numberOfPPointers = mibFileBuffer.readUint32BE(4)

        for(let i =1;i<=numberOfPPointers;i++){
          const newMibObj = {
            offset:{
              firstString:"",
              lastString:"",
              firstPointer:"",
              lastPointer:""
            },
            name:mibName+"-1",
            origin:"MHTri",
            path:mibPath
          }

          const firstString = mibFileBuffer.readUint32BE(8*i)
          
          let k =0
          let m =0
          while (m<=7){
            if(mibFileBuffer[firstString+k]!=0&&mibFileBuffer[firstString+k+1]===0){
              m++
            }
            k++
          }
        
          newMibObj.offset.lastString = toHexadecimal(firstString+k)
          newMibObj.offset.firstString = toHexadecimal(firstString)

          mibListObjsData.push(newMibObj)
        }
      }
    })

    if(mibList.length>0){
      loadMibConfiguration(1)//First mib
      goToFirstSection()
    }else{
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText(`Not valid files in folder`)
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
      shutdownMibMode()
      return
    }
  })
  chooseFolderDialog.exec();
}

//Generates a sample CSV file to help users understand the expected format
//Contains "Hello;Hola" as an example of source;translation pairs
function createCSVFile(){
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
    }else{
      errorMessageBox.setWindowTitle("Error")
      errorMessageBox.setText(`New .csv created in root folder sucessfully`)
      errorMessageButton.setText("                                                Ok                                              ")
      errorMessageBox.exec()
    }
  })
}

//Stores the currently selected file path. This is used for hexView
function setSelectedMainProgramFile(filePath){
  selectedFile = filePath
}

//Updates the offset input fields based on whether string or pointer values are provided
function updateNeccesaryHexValues(values){
  if(values.firstString){
    firstStringOffsetLineEdit.setText(values.firstString)
    lastStringOffsetLineEdit.setText(values.postLastString)
  }else{
    firstPointerOffsetLineEdit.setText(values.firstPointer)
    lastPointerOffsetLineEdit.setText(values.postLastPointer)
  } 
}

//Toolbar and main Window--------------------------------------------------------
const win = new QMainWindow;
win.setFixedSize(728, 504);
win.setWindowTitle('MH Pointers Tool');

const globalQApplication = new QApplication()

const mainMenu = new QMenu()

const mainMenuAction1 = new QAction();
const mainMenuAction2 = new QAction();
const mainMenuAction3 = new QAction();
const mainMenuAction4 = new QAction(); //Open all .mib files in folder
const mainMenuAction5 = new QAction();
const mainMenuAction6 = new QAction();
const mainMenuAction7 = new QAction();
const mainMenuAction8 = new QAction();

mainMenu.setTitle("Menu")
mainMenuAction1.setText('Load file');
mainMenuAction2.setText('Load Pointers Table (MH2/P3)');
mainMenuAction3.setText('Create a Pointers Table for this file');
mainMenuAction4.setText('Open all .mib files in folder');
mainMenuAction5.setText('Align two .csv by rows');
mainMenuAction6.setText('Create .csv file');
mainMenuAction7.setText("About");
mainMenuAction8.setText('Exit');

mainMenu.addAction(mainMenuAction1)
mainMenu.addAction(mainMenuAction2) 
mainMenu.addAction(mainMenuAction3)
mainMenu.addAction(mainMenuAction4)
mainMenu.addAction(mainMenuAction5)
mainMenu.addAction(mainMenuAction6)
mainMenu.addAction(mainMenuAction7)
mainMenu.addAction(mainMenuAction8)

const encodingMenu = new QMenu()
encodingMenu.setTitle("Encoding: UTF-8")
encodingMenu.setToolTip("Encoding used to load and save text.")
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
const fileSizeMenuAction2NoKeepSize = new QAction();

fileSizeMenu.addAction(fileSizeMenuAction1) 
fileSizeMenu.addAction(fileSizeMenuAction2NoKeepSize)

fileSizeMenuAction1.setText('Keep');
fileSizeMenuAction1.setCheckable(true)
fileSizeMenuAction1.setChecked(true)
fileSizeMenuAction1.setEnabled(false)

fileSizeMenuAction2NoKeepSize.setText("Don't keep");
fileSizeMenuAction2NoKeepSize.setCheckable(true)

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
fileSizeMenuAction2NoKeepSize.addEventListener("triggered",function () {fileSize(1)})

//Open all .mib strings in folder
mainMenuAction4.addEventListener("triggered", function (){openAndProcessAllMibs()})

//Align two csv by rows----------------------------------------------------------
mainMenuAction5.addEventListener("triggered", function (){
  alignTwoCsv()
})

// Create .csv file
mainMenuAction6.addEventListener("triggered", function (){
  createCSVFile()
})

//About----------------------------------------------------------
const aboutDialog = new QDialog()
aboutDialog.setModal(true)
aboutDialog.setWindowTitle('About')
aboutDialog.setInlineStyle(`
background-color:white;
`)
mainMenuAction7.addEventListener("triggered",function (){
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
aboutTitleLabel.setText("MH Pointers Tool" +" - Ver. 1.2")
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
aboutDonateLabel.setText('<a href="https://ko-fi.com/amaillo">Ko-fi</a>' + '  | <a href="0xe681952e9083726aae7b545e6b4608acdc444226">USDT (BSC)</a> | <a href="TJL2fpkt98ervNimA5dMarWeuLbG2rt1az">USDT (TRX)</a>')
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

//When a item in the main list widget is clicked,
//all the relevant info for that string is set.
listWidget.addEventListener("clicked",() => {
  
  stringEditorTextEdit.setPlainText(listWidget.currentItem().text())

  if(sectionNameHeader != "Section name"){

    sectionDetailsLabel.setText(`${sectionNameHeader}: String#${listWidget.currentRow()+1}`)
  }else{

    sectionDetailsLabel.setText(`Section name: String#${listWidget.currentRow()+1}`)
  }

  if(addressOfEachStringInMemory[listWidget.currentRow()] != undefined){
    stringOffsetLabel.setText(`String Offset: ${offsetOfEachString[listWidget.currentRow()]}`+"/"+ "0x" + `${addressOfEachStringInMemory[listWidget.currentRow()].toString(16).toUpperCase().replaceAll("00","")}`)
  }else{
    stringOffsetLabel.setText(`String Offset: ${offsetOfEachString[listWidget.currentRow()]}`)
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

// const clipboard = QApplication.clipboard();

//If for some reason this program is focused when the clipboard is
//empty, the clipboard is changed to " ". For some reason if you try to
//paste an empty clipboard to a QPlainTextEdit causes a crash, this measure avoid that.
// stringEditorTextEdit.addEventListener("FocusIn",function(){
// if(clipboard.text(QClipboardMode.Clipboard) ===""){
//   clipboard.setText(" ")
// }
// })

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
characters16Button.setText(`Characters per line`)
characters16Layout.addWidget(characters16Button)

characters16Button.addEventListener('clicked',function (){specificCharactersPerLine()});
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


//MWA:Pointer offsets------------------------------------------------------
const pointerOffset = new QWidget();
midWidgetLayout.addWidget(pointerOffset)
pointerOffset.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
flex:1;
`)

const pointerOffsetLayout = new QBoxLayout(0);
pointerOffset.setLayout(pointerOffsetLayout)

const pointerOffsetLabel = new QLabel();
pointerOffsetLabel.setText("Pointer Offset: N/A")
pointerOffsetLabel.setTextInteractionFlags(1)
pointerOffsetLayout.addWidget(pointerOffsetLabel)

//MWA:String Offset------------------------------------------------------
const stringOffset = new QWidget();
midWidgetLayout.addWidget(stringOffset)
stringOffset.setInlineStyle(`
flex:1;
`)
const stringOffsetLayout = new QBoxLayout(0);
stringOffset.setLayout(stringOffsetLayout)

const stringOffsetLabel = new QLabel();

stringOffsetLabel.setText(`String Offset: File/"RAM" (Not accurate)`)
stringOffsetLabel.setTextInteractionFlags(1)
stringOffsetLayout.addWidget(stringOffsetLabel)


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


//RWA:Table Pointer Offsets---------------------------------------------------------------

const pointersTableOffsets = new QWidget();
const pointersTableOffsetsMainWidget = new QWidget();
const pointersTableOffsetsLayout = new FlexLayout();
const pointersTableOffsetsMainLayout = new FlexLayout();

pointersTableOffsets.setLayout(pointersTableOffsetsLayout)
pointersTableOffsetsMainWidget.setLayout(pointersTableOffsetsMainLayout)
rightWidgetLayout.addWidget(pointersTableOffsetsMainWidget)

pointersTableOffsets.setInlineStyle(`
flex-direction:column;
height:0px;
`)


function rezisePointersTableLineEdit() {

  if(pointersTableModeON===true){
    pointersTableOffsets.setInlineStyle(`
    flex-direction:column;
    height:40x;
    `)
  }else{
    pointersTableOffsets.setInlineStyle(`
    flex-direction:column;
    height:0x;
    `)
  }

}

const firstPointersTableOffsetLineEdit = new QLineEdit();
const lastPointersTableOffsetLineEdit = new QLineEdit();
firstPointersTableOffsetLineEdit.setReadOnly(true)
lastPointersTableOffsetLineEdit.setReadOnly(true)
firstPointersTableOffsetLineEdit.setToolTip("First pointer table offset in the file, for the section that you will translate (without 0x).")
firstPointersTableOffsetLineEdit.setPlaceholderText("First pointer table offset")
lastPointersTableOffsetLineEdit.setPlaceholderText("Post-last pointer table affset")
lastPointersTableOffsetLineEdit.setToolTip("Post-last pointer table affset in the file, for the section that you will translate (without 0x).")
lastPointersTableOffsetLineEdit.setInlineStyle(`
width:118px;
font-size:11px;
`)
firstPointersTableOffsetLineEdit.setInlineStyle(`
width:119px;
font-size:11px;
`)


const pointersTableOffsetTitleWidget = new QWidget()
const pointersTableOffsetLineEditWidget = new QWidget()


pointersTableOffsetsMainLayout.addWidget(pointersTableOffsets)
pointersTableOffsetsLayout.addWidget(pointersTableOffsetTitleWidget)
pointersTableOffsetsLayout.addWidget(pointersTableOffsetLineEditWidget)

const pointersTableOffsetTitleWidgetLayout = new FlexLayout()
const pointersTableOffsetLineEditWidgetLayout = new FlexLayout()

pointersTableOffsetLineEditWidget.setInlineStyle(`
flex-direction:row;
`)

pointersTableOffsetTitleWidget.setLayout(pointersTableOffsetTitleWidgetLayout)
pointersTableOffsetLineEditWidget.setLayout(pointersTableOffsetLineEditWidgetLayout)

const pointerTableOffsetLineEditTitle = new QLabel();
pointerTableOffsetLineEditTitle.setText("Pointers Table Offsets *")
pointerTableOffsetLineEditTitle.setAlignment(132)
pointerTableOffsetLineEditTitle.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

pointersTableOffsetTitleWidgetLayout.addWidget(pointerTableOffsetLineEditTitle)
pointersTableOffsetLineEditWidgetLayout.addWidget(firstPointersTableOffsetLineEdit)
pointersTableOffsetLineEditWidgetLayout.addWidget(lastPointersTableOffsetLineEdit)

//RWA:Pointer Offsets---------------------------------------------------------------
const pointerOffsets = new QWidget();
const pointerOffsetsLayout = new FlexLayout();
pointerOffsets.setLayout(pointerOffsetsLayout)
rightWidgetLayout.addWidget(pointerOffsets)
pointerOffsets.setInlineStyle(`
flex-direction:column;
`)

const firstPointerOffsetLineEdit = new QLineEdit();
const lastPointerOffsetLineEdit = new QLineEdit();
firstPointerOffsetLineEdit.setToolTip("First pointer offset in the file, for the section that you will translate (without 0x).")
firstPointerOffsetLineEdit.setPlaceholderText("First pointer offset")
lastPointerOffsetLineEdit.setPlaceholderText("Post-last pointer offset")
lastPointerOffsetLineEdit.setToolTip("Post-last pointer offset in the file, for the section that you will translate (without 0x).")
lastPointerOffsetLineEdit.setInlineStyle(`
width:118px;
font-size:11px;
`)
firstPointerOffsetLineEdit.setInlineStyle(`
width:119px;
font-size:11px;
`)


const pointerOffsetTitleWidget = new QWidget()
const pointerOffsetLineEditWidget = new QWidget()

pointerOffsetsLayout.addWidget(pointerOffsetTitleWidget)
pointerOffsetsLayout.addWidget(pointerOffsetLineEditWidget)

const pointerOffsetTitleWidgetLayout = new FlexLayout()
const pointerOffsetLineEditWidgetLayout = new FlexLayout()

pointerOffsetLineEditWidget.setInlineStyle(`
flex-direction:row;
`)

pointerOffsetTitleWidget.setLayout(pointerOffsetTitleWidgetLayout)
pointerOffsetLineEditWidget.setLayout(pointerOffsetLineEditWidgetLayout)

const pointerOffsetLineEditTitle = new QLabel();
pointerOffsetLineEditTitle.setText("Pointer Offsets")
pointerOffsetLineEditTitle.setAlignment(132)
pointerOffsetLineEditTitle.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

pointerOffsetTitleWidgetLayout.addWidget(pointerOffsetLineEditTitle)
pointerOffsetLineEditWidgetLayout.addWidget(firstPointerOffsetLineEdit)
pointerOffsetLineEditWidgetLayout.addWidget(lastPointerOffsetLineEdit)


//RWA: String Offsets-----------------------------------------------------
const stringOffsetsTitle = new QWidget();
const stringOffsetsLayout2 = new FlexLayout();
stringOffsetsTitle.setLayout(stringOffsetsLayout2)
rightWidgetLayout.addWidget(stringOffsetsTitle)

const stringOffsetsTitleLabel = new QLabel()
stringOffsetsTitleLabel.setText("String Offsets *")
stringOffsetsTitleLabel.setAlignment(132)
stringOffsetsTitleLabel.setInlineStyle(`
border-color:black;
border-style:solid;
border-bottom-width:1px;
`)

stringOffsetsLayout2.addWidget(stringOffsetsTitleLabel)

const stringOffsets = new QWidget();
const stringOffsetsLayout = new FlexLayout();
stringOffsets.setLayout(stringOffsetsLayout)
rightWidgetLayout.addWidget(stringOffsets)
stringOffsets.setInlineStyle(`
flex-direction:row;
`)

const firstStringOffsetLineEdit = new QLineEdit();
const lastStringOffsetLineEdit = new QLineEdit();
firstStringOffsetLineEdit.setPlaceholderText("First string offset")
firstStringOffsetLineEdit.setToolTip("First string offset in the file, for the section that you will translate (without 0x).")
lastStringOffsetLineEdit.setPlaceholderText("Post-last string offset")
lastStringOffsetLineEdit.setToolTip("Post-last string offset in the file, for the section that you will translate (without 0x).")


lastStringOffsetLineEdit.setInlineStyle(`
width:118px;
font-size:11px;
`)

firstStringOffsetLineEdit.setInlineStyle(`
width:119px;
font-size:11px;
`)

stringOffsetsLayout.addWidget(firstStringOffsetLineEdit)
stringOffsetsLayout.addWidget(lastStringOffsetLineEdit)

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

const pointersViewerFull = new QListWidget()
const pointersViewerlistWidgetLayout = new QBoxLayout(1);

pointersViewerFull.setLayout(pointersViewerlistWidgetLayout)
pointersViewerFull.setInlineStyle(`
height:150px;
border-style:solid;
border-width:3px;
background-color:white;
`)

pointersViewerFull.setSizePolicy(4,4)
const pointersViewerButtonToHide00 = new QCheckBox()
pointersViewerButtonToHide00.setEnabled(false)
pointersViewerButtonToHide00.setContentsMargins(0,0,0,0)
pointersViewerButtonToHide00.setText("Hide 0's of viewer")
pointersViewerLeftLayout.addWidget(pointersViewerButtonToHide00)

const pointersViewerSpecific = new QListWidget()
pointersViewerSpecific.setEnabled(false)
pointersViewerSpecific.setInlineStyle(`
height:60px;
width:110px;
background-color:white;
`)
pointersViewerLeftLayout.addWidget(pointersViewerSpecific)

const pointersEditor = new QLineEdit()
pointersEditor.setEnabled(false)

pointersEditor.setPlaceholderText("Pointer to edit")
pointersEditor.setInlineStyle(`
font-size:12px;
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
pointersViewerSpecific.addEventListener("clicked",function(){

  pointersEditor.setText(`${pointersViewerSpecific.currentItem().text()}`)
  pointersEditorLabel.setText(`#${pointersViewerSpecific.currentRow()+1} `)

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
pointersEditorRealocateButton.setToolTip("Relocate the selected pointer to a new string (If there are space to do it) and save.\n\nNote: If the selected pointer offset is left in emtpy in the above typing field\nit will trigger an hex viewer to choose manually the offset where to put the text.\nIf the offset into the field is different, it will try to put the text there.\nIf the selected pointer offset and the one in the field are the same,\nit will try to put the text at the end of the string section (faster method).")
pointersViewerLeftLayout.addWidget(pointersEditorRealocateButton)

//Change the values of a pointer to make it match with a new empty string
pointersEditorRealocateButton.addEventListener("clicked",function(){
  relocateToNewString()
})

pointersViewerRightLayout.addWidget(pointersViewerFull)
pointersViewerButtonToHide00.addEventListener("clicked",function(){
  hideShow()
})


//When a item in the pointers viewer is selected (usually by highlightPointers),
//this add a Widget right above of it, the widget
//has exactly the same values of the pointer but with red
//color (if is the first) or blue (for the rest). Also add a enumeration
//to the pointers viewer and the specific pointers viewer.
pointersViewerFull.addEventListener("itemSelectionChanged",function (){

  let i = 0;
  let k = 0;
  let phase = 0
  let counter =1
  quantityOfSharedPointers=1

  pointersViewerSpecific.clear()
  pointersEditor.clear()
  pointersEditorLabel.setText("#n")

  while(extractedPointersIn4[i] != undefined){
    
    if(extractedPointersIn4[i].toString("hex").toUpperCase() === pointersViewerFull.currentItem().text().toUpperCase() && phase===0){
      
      pointerOffsetLabel.setText(`Pointer Offset: ${offsetOfEachPointer[i].toString(16).toUpperCase()}`)

      if(oldSelectedString != -1){

        pointersViewerFull.removeItemWidget(pointersViewerFull.item(oldSelectedString))
        
        while(itemPositionOfSharedPointers[k]!=undefined){
          pointersViewerFull.removeItemWidget(pointersViewerFull.item(itemPositionOfSharedPointers[k]))
          k=k+1;
        }
        itemPositionOfSharedPointers=[]
        k=0;
      }
      if(pointersViewerFull.currentItem().text() ==="00000000"||pointersViewerFull.currentRow() ===0){
        break
      }

      let pointerViewerListQWidget = new QWidget()
      let pointerViewerListQWidgetLayout = new FlexLayout
      pointerViewerListQWidget.setLayout(pointerViewerListQWidgetLayout)
      let pointerViewerListQWidgetText = new QLabel
      pointerViewerListQWidgetText.setText(`${pointersViewerFull.item(i).text()}` + ` ${counter}`)
      pointerViewerListQWidgetText.setInlineStyle(`
      color:red;
      margin: 0 1 0 0;
      `)
      pointerViewerListQWidgetLayout.addWidget(pointerViewerListQWidgetText)
      pointersViewerFull.setItemWidget(pointersViewerFull.item(i),pointerViewerListQWidget)
      
      phase=1;
      oldSelectedString = i;
      
      const tempItem = new QListWidgetItem()
      tempItem.setText(pointersViewerFull.item(i).text())
      pointersViewerSpecific.addItem(tempItem)
      
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
      pointersViewerSpecific.setItemWidget(pointersViewerSpecific.item(0),pointerViewerListQWidget2)
      counter = counter+1;
      
    }else if(extractedPointersIn4[i].toString("hex").toUpperCase() === pointersViewerFull.currentItem().text().toUpperCase() && phase===1){
      let pointerViewerListQWidget2 = new QWidget()
      let pointerViewerListQWidgetLayout2 = new FlexLayout
      pointerViewerListQWidget2.setLayout(pointerViewerListQWidgetLayout2)
      let pointerViewerListQWidgetText2 = new QLabel
      pointerViewerListQWidgetText2.setText(`${pointersViewerFull.item(i).text()}` + `  ${counter}`)
      pointerViewerListQWidgetText2.setInlineStyle(`
      color:midnightblue;
      margin: 0 1 0 0;
      `)
      pointerViewerListQWidgetLayout2.addWidget(pointerViewerListQWidgetText2)
      pointersViewerFull.setItemWidget(pointersViewerFull.item(i),pointerViewerListQWidget2)
      quantityOfSharedPointers=quantityOfSharedPointers+1;
      itemPositionOfSharedPointers[k]= i
      
      const tempItem = new QListWidgetItem()
      tempItem.setText(pointersViewerFull.item(i).text())
      pointersViewerSpecific.addItem(tempItem)
      
      let pointerViewerListQWidget3 = new QWidget()
      let pointerViewerListQWidgetLayout3 = new FlexLayout
      pointerViewerListQWidget3.setLayout(pointerViewerListQWidgetLayout3)
      let pointerViewerListQWidgetText3 = new QLabel
      pointerViewerListQWidgetText3.setText(`${counter}`)
      pointerViewerListQWidgetText3.setInlineStyle(`
      color:black;
      margin-left:35px;
      `)
      pointerViewerListQWidgetLayout3.addWidget(pointerViewerListQWidgetText3)
      pointersViewerSpecific.setItemWidget(pointersViewerSpecific.item(k+1),pointerViewerListQWidget3)
      
      counter = counter+1;
      k=k+1
    }
    i=i+1;
  }
  itemPositionOfSharedPointers.unshift(pointersViewerFull.currentRow())
  pointersViewerSpecific.setCurrentRow(0)
  
  pointersViewerTitleLabel.setText(`Pointers Viewer (${extractedPointersIn4.length-hiddenPointers}) (${quantityOfSharedPointers})`)

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
csvButton.addEventListener("clicked",function (){csvTranslation(false)})
csvButton.setEnabled(false)

const csvButton2 = new QPushButton();
csvButton2.setText("Translate strings partially using a .csv")
csvTranslatorLayout.addWidget(csvButton2)
csvButton2.setToolTip("Use a .csv with semicolons to translate a group of strings. The \n.csv must contain two columns, the first must have translated strings\nand the second one is for the untranslated text. Each string\nmust be separated from another with at least one row of space and\nboth strings must start in the same row.\nMatch words or phrases inside a string.")
csvButton2.addEventListener("clicked",function (){csvTranslation(true)})
csvButton2.setEnabled(false)

const translatedStringsQProgressDialog = new QProgressDialog()
translatedStringsQProgressDialog.updatesEnabled(true)
translatedStringsQProgressDialog.cancel()
translatedStringsQProgressDialog.setFixedSize(260,200)
translatedStringsQProgressDialog.setModal(true)
translatedStringsQProgressDialog.addEventListener("canceled",function (){

  csvTranslationCanceled = true
})

//RWA:Export all data to a CSV button------------------------------------------
const exportAllData = new QWidget();
const exportAllDataLayout = new FlexLayout();
exportAllData.setLayout(exportAllDataLayout)
rightWidgetLayout.addWidget(exportAllData)

const exportAllButton = new QPushButton();
exportAllButton.setText("Export all the data to a .csv")
exportAllDataLayout.addWidget(exportAllButton)
exportAllButton.setToolTip("Export all the data found in the file into a comfy .csv\nData sorting is up to you.")
exportAllButton.addEventListener("clicked",function() {exportAllSelectionScreen()})
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
// bottomRightSquareLayout.addWidget(fastButton)

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

let errorMessageBox = new QMessageBox()
let errorMessageButton = new QPushButton()
errorMessageButton.setInlineStyle(`
`)
errorMessageBox.setDetailedText("Task completed.")
errorMessageBox.addButton(errorMessageButton)

mainMenuAction1.addEventListener('triggered', function () {
  
  if(pointersTableModeON===true){
    removePointersTable()
  }else{
    loadFile()
  }

})

mainMenuAction8.addEventListener('triggered', function (){
  let exit = new QApplication()
  exit.exit(0)
})
saveSettingsButton.addEventListener("clicked",function (){saveAndPrepare(true)})
saveSettingsButton2.addEventListener("clicked",function (){saveAndPreparePointerless(true)})


function parseOldCfgFormat(cfgBuffer) {
  const projectsConfHexArr = cfgBuffer.toString("hex").split("5b53504c49545d0d0a");
  const configurations = [];

  for (const sectionHex of projectsConfHexArr) {
    if (!sectionHex) continue;

    const parts = sectionHex.split("0d0a");
    
    const decode = (hex) => {
      if (!hex || hex === "2a") return "";
      return Buffer.from(hex, "hex").toString("utf8");
    };
    
    const sectionNumber = parseInt(decode(parts[0]), 10);
    if (isNaN(sectionNumber)) continue;

    configurations.push({
      sectionNumber: sectionNumber,
      sectionName: decode(parts[1]),
      firstPointerOffset: decode(parts[2]),
      lastPointerOffset: decode(parts[3]),
      firstStringOffset: decode(parts[4]),
      lastStringOffset: decode(parts[5]),
      filePath: decode(parts[6]),
      encoding: decode(parts[7]) === "0" ? "UTF8" : "SJIS"
    });
  }
  return configurations;
}


/**
* Runs at application startup to prepare the configuration file.
* Incorporates backwards compatibility logic to convert older .cfg files.
*/
function initializeSettings(){
  try {
    // 1. If the modern .json file exists, use it directly.
    if (fs.existsSync("./settings.json")) {
      console.log("settings.json found, loading configuration...");
      loadConfiguration();
      return;
    }

    // 2. If not, find an old .cfg file to convert.
    if (fs.existsSync("./settings.cfg")) {
      console.log("Old .cfg file found. Converting to .json...");
      const cfgContent = fs.readFileSync("./settings.cfg");
      const configurations = parseOldCfgFormat(cfgContent);
      
      const jsonString = JSON.stringify(configurations, null, 2);
      fs.writeFileSync("./settings.json", jsonString, 'utf8');
      console.log("Conversion successful. New settings.json created.");

      fs.renameSync("./settings.cfg", "./settings.cfg" + '.bak');
      console.log("The old .cfg file has been renamed to .cfg.bak");

      loadConfiguration(); // Load from the newly created file.
      return;
    }

    // 3. If no configuration file exists, create a new, empty one.
    console.log("No configuration file found, creating settings.json by default...");
    fs.writeFileSync("./settings.json", '[]', 'utf8');
    console.log("settings.json successfully created.");
    
    setDefaultValues();
    start();

  }catch (err) {
    console.error("Error during initialization:", err);
    errorMessageBox.setWindowTitle("Initialization Error");
    errorMessageBox.setText("ERROR! The configuration file could not be created, read, or converted..");
    errorMessageButton.setText("Ok");
    errorMessageBox.exec();
    
    setDefaultValues();
    start();
  }
}
initializeSettings()

//CS:Drag and drop configurations---------------------------
win.setAcceptDrops(true);

win.addEventListener(WidgetEventTypes.DragEnter, (e) => {
    let ev = new QDragMoveEvent(e);
    ev.accept(); //Accept the drop event, which is crucial for accepting further events
});

//Get the path of any file dropped into the tool window
win.addEventListener(WidgetEventTypes.Drop, (e) => {

  if(pointersTableModeON===true){

  }else{
    let dropEvent = new QDropEvent(e);
    let mimeData = dropEvent.mimeData();
    let urls = mimeData.urls();
    for (let url of urls) {

      if(Os.platform()==="linux"){
        selectedFile = url.toString().replace("file://","");
        start()
      }else{
        selectedFile = url.toString().replace("file:///","");
        start()
      }
    }
  }
});

win.addEventListener("Close",function(){
  shutdownHexView()
  process.exit(0);
})



//Global font---------------------------------------------
// const appFont = new QFont()

// if(appFont.family()==="Segoe UI"){

// }
// else if(appFont.family()==="Ubuntu"){

//   globalQApplication.setStyleSheet(`
//   * {
//   font-size:13px;
//   }
//   `)
// }
// else{

//   globalQApplication.setStyleSheet(`
//   * {
//   font-size:12px;
//   }
//   `)
// }

globalQApplication.setStyleSheet(`
* {
font-size:12px;
}
`)

//CS:Show window------------------------------------------
win.setCentralWidget(rootView);
win.show();

module.exports = {
  setShiftJISEncoding,
  setUTF8Encoding,
  start,
  relocateStringPosition,
  selectedMainProgramFile:selectedFile,
  setSelectedMainProgramFile,
  updateNeccesaryHexValues
}

global.win = win;