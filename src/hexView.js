const { 
    QMainWindow, 
    QGridLayout, 
    QWidget, 
    QTableWidget, 
    QTableWidgetItem, 
    QDragMoveEvent, 
    WidgetEventTypes, 
    QDropEvent, 
    QKeyEvent, 
    QBrush, 
    QColor, 
    QPushButton, 
    AlignmentFlag, 
    QFont, 
    QStatusBar, 
    QLabel, 
    QLineEdit, 
    QApplication, 
    QBoxLayout, 
    Direction,
    TextFormat 
} = require ("@nodegui/nodegui")

const {
    setShiftJISEncoding,
    setUTF8Encoding,
    start,
    setSelectedMainProgramFile,
    updateNeccesaryHexValues,
    relocateStringPosition
} = require ("./index.js");

const fs = require('fs');
const Os = require('os');
const path = require('path');
const EncodingModule = require('encoding-japanese');

// Global constants
const EditTriggerNoEditTriggers = 0;
const SelectionModeNoSelection = 0;
const ResizeModeFixed = 1;

let lastClickedCellByteIndex = null;
let isShiftPressed = false;
let isSelectingByDragging = false;
let startByteIndexForClick = null;
let currentBuffer = null;
let currentEncoding = 'UTF8';

let selectionStartByteIndex = null;
let selectionEndByteIndex = null;

// VARIABLES FOR SEARCH NAVIGATION
let hexSearchResults = [];
let charSearchResults = [];
let currentHexResultIndex = -1;
let currentCharResultIndex = -1;

const SelectedColor = new QBrush(new QColor('#0078d4'));
const DefaultColor = new QBrush(new QColor('white'));
const boldFont = new QFont();
boldFont.setBold(true);

const statusBar = new QStatusBar();
const lineInfoLabel = new QLabel();
const charPosLabel = new QLabel();
const selSizeLabel = new QLabel();
const encodingLabel = new QLabel();

let hexTableInstance = null;
let utf8ButtonInstance = null;
let shiftJISButtonInstance = null;
let hexWindowInstance = null;
let offsetLabelInstance = null;
let charLabelInstance = null;

// VARIABLES FOR VIRTUALIZATION
const BYTES_PER_ROW = 16;
const ROWS_TO_RENDER = 16;
let lastHexScrollValue = 0;

// Utility functions adjusted for virtualization
function getByteIndexFromRowCol(row, col) {
    if (!currentBuffer) return -1;
    return row * BYTES_PER_ROW + col;
}

function updateStatusBar(startByte, endByte) {
    if (!currentBuffer) {
        lineInfoLabel.setText(`Ln:0/Col:0`);
        charPosLabel.setText(`CharPos:0/0`);
        selSizeLabel.setText(`SelSize:0`);
        encodingLabel.setText(currentEncoding);
        return;
    }

    if (startByte === null || endByte === null) {
        lineInfoLabel.setText(`Ln:0/Col:0`);
        charPosLabel.setText(`CharPos:0/${currentBuffer.length}`);
        selSizeLabel.setText(`SelSize:0`);
    } else {
        const endRow = Math.floor(endByte / BYTES_PER_ROW);
        const endCol = endByte % BYTES_PER_ROW;
        const selectionSize = Math.abs(endByte - startByte) + 1;
        lineInfoLabel.setText(`Ln:${endRow + 1}/Col:${endCol + 1}`);
        charPosLabel.setText(`CharPos:${endByte}/${currentBuffer.length}`);
        selSizeLabel.setText(`SelSize:${selectionSize}`);
    }

    encodingLabel.setText(currentEncoding);
}

function loadFileAndRender(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            selectionStartByteIndex = null;
            selectionEndByteIndex = null;
            currentBuffer = fs.readFileSync(filePath);

            renderHexView();
            updateStatusBar(null, null);

            hexSearchResults = [];
            charSearchResults = [];
            currentHexResultIndex = -1;
            currentCharResultIndex = -1;

            const fileName = path.basename(filePath);
            hexWindowInstance.setWindowTitle(`hexView - ${fileName}`);
        } catch (err) {
            console.error("Error reading file:", err);
        }
    }
}

function setUTF8EncodingAndRender() {
    if (currentBuffer) {
        currentEncoding = 'UTF8';
        setUTF8Encoding(true);
        shiftJISButtonInstance.setEnabled(true);
        utf8ButtonInstance.setEnabled(false);
        renderHexView();
        updateStatusBar(null, null);
    }
}

function setShiftJISEncodingAndRender() {
    if (currentBuffer) {
        currentEncoding = 'SJIS';
        setShiftJISEncoding(true);
        utf8ButtonInstance.setEnabled(true);
        shiftJISButtonInstance.setEnabled(false);
        renderHexView();
        updateStatusBar(null, null);
    }
}

function hexView(selectedFile, initialEncoding, listWitgetObj) {
    if (hexWindowInstance) {
        loadFileAndRender(selectedFile);
        hexWindowInstance.activateWindow();
        return hexWindowInstance;
    }

    const hexWindow = new QMainWindow();
    hexWindowInstance = hexWindow;

    hexWindow.addEventListener("Close", () => {
        hexWindowInstance = null;
        currentBuffer = null
    });

    hexWindow.setFixedSize(860, 674);
    const rootView = new QWidget();
    const mainLayout = new QGridLayout();
    rootView.setLayout(mainLayout);

    mainLayout.setColumnStretch(0, 0);
    mainLayout.setColumnStretch(1, 1);
    mainLayout.setColumnStretch(2, 1);
    mainLayout.setColumnStretch(3, 0);
    mainLayout.setColumnStretch(4, 0);
    mainLayout.setRowStretch(1, 1);

    if (initialEncoding) {
        currentEncoding = initialEncoding;
    }
    
    // Top bar buttons
    const selectAsStringButton = new QPushButton();
    selectAsStringButton.setText('Select as strings');
    const selectAsPointerButton = new QPushButton();
    selectAsPointerButton.setText('Select as pointers');
    const utf8Button = new QPushButton();
    utf8Button.setText('UTF-8');
    const shiftJISButton = new QPushButton();
    shiftJISButton.setText('Shift-JIS');

    const selectAsStringPositionButton = new QPushButton();
    selectAsStringPositionButton.setText('Select as new string position');

    // Search fields and buttons for Hex
    const hexSearchInput = new QLineEdit();
    hexSearchInput.setPlaceholderText('Search Hex 00 00 00 00 or 00000000');
    const hexSearchButton = new QPushButton();
    hexSearchButton.setText('Search');
    hexSearchButton.setFixedWidth(50);
    const hexPreviousButton = new QPushButton();
    hexPreviousButton.setText('<');
    hexPreviousButton.setFixedWidth(20);
    const hexNextButton = new QPushButton();
    hexNextButton.setText('>');
    hexNextButton.setFixedWidth(20);
    
    // Search fields and buttons for Characters
    const charSearchInput = new QLineEdit();
    charSearchInput.setPlaceholderText('Search Text...');
    charSearchInput.setFixedWidth(110);
    const charSearchButton = new QPushButton();
    charSearchButton.setText('Search');
    charSearchButton.setFixedWidth(50);
    const charPreviousButton = new QPushButton();
    charPreviousButton.setText('<');
    charPreviousButton.setFixedWidth(20);
    const charNextButton = new QPushButton();
    charNextButton.setText('>');
    charNextButton.setFixedWidth(20);

    hexTableInstance = new QTableWidget(0, BYTES_PER_ROW);
    utf8ButtonInstance = utf8Button;
    shiftJISButtonInstance = shiftJISButton;

    offsetLabelInstance = new QLabel();
    charLabelInstance = new QLabel();
    
    charLabelInstance.setTextInteractionFlags(1)
    offsetLabelInstance.setTextInteractionFlags(1)
    charLabelInstance.setTextFormat(TextFormat.RichText);
    
    offsetLabelInstance.setInlineStyle(`
        background-color: #f0f0f0;
        font-family: monospace;
        font-size: 12px;
        padding: 0;
        margin-top:20px;
    `);

    charLabelInstance.setFixedWidth(200);

    if (currentEncoding === "SJIS") {
        shiftJISButtonInstance.setEnabled(false);
        utf8ButtonInstance.setEnabled(true);
    } else {
        shiftJISButtonInstance.setEnabled(true);
        utf8ButtonInstance.setEnabled(false);
    }

    // Layouts using QBoxLayout
    const hexSearchLayout = new QBoxLayout(Direction.LeftToRight);
    hexSearchLayout.addWidget(hexSearchInput, 1);
    hexSearchLayout.addWidget(hexSearchButton);
    hexSearchLayout.addWidget(hexPreviousButton);
    hexSearchLayout.addWidget(hexNextButton);
    
    const hexSearchWidget = new QWidget();
    hexSearchWidget.setLayout(hexSearchLayout);
    
    const charSearchLayout = new QBoxLayout(Direction.LeftToRight);
    charSearchLayout.addWidget(charSearchInput, 1);
    charSearchLayout.addWidget(charSearchButton);
    charSearchLayout.addWidget(charPreviousButton);
    charSearchLayout.addWidget(charNextButton);

    const charSearchWidget = new QWidget();
    charSearchWidget.setLayout(charSearchLayout);

    const headerLayout = new QBoxLayout(Direction.LeftToRight);

    if(!listWitgetObj){
        headerLayout.addWidget(selectAsStringButton);
        headerLayout.addWidget(selectAsPointerButton);
    }else{
        headerLayout.addWidget(selectAsStringPositionButton);
    }

    headerLayout.addWidget(utf8ButtonInstance);
    headerLayout.addWidget(shiftJISButtonInstance);
    
    const headerWidget = new QWidget();
    headerWidget.setLayout(headerLayout);
    
    mainLayout.addWidget(headerWidget, 0, 1, 1, 4);
    
    mainLayout.addWidget(offsetLabelInstance, 1, 0, 1, 1);
    mainLayout.addWidget(hexTableInstance, 1, 1, 1, 2);
    mainLayout.addWidget(charLabelInstance, 1, 3, 1, 2);

    mainLayout.addWidget(hexSearchWidget, 2, 1, 1, 2);
    mainLayout.addWidget(charSearchWidget, 2, 3, 1, 2);


    ([hexTableInstance]).forEach((table) => {
        table.setEditTriggers(EditTriggerNoEditTriggers);
        table.setSelectionMode(SelectionModeNoSelection);

        table.setInlineStyle(`
            border: none;
            QHeaderView::section {
                padding-left: 2px;
                padding-right: 2px;
                background-color: #f0f0f0;
            }
            QTableWidget QTableCornerButton::section {
                background: white;
                border: none;
            }
            QTableWidget::item {
                border: 1px solid #999;
            }
        `);

        for (let i = 0; i < BYTES_PER_ROW; i++) {
            table.setColumnWidth(i, 23);
        }
    });

    const horizontalHeaderLabels = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "0A", "0B", "0C", "0D", "0E", "0F"];
    
    hexTableInstance.setHorizontalHeaderLabels(horizontalHeaderLabels);

    const hexHeader = hexTableInstance.horizontalHeader();
    hexHeader.setSectionResizeMode(ResizeModeFixed);
    hexHeader.setDefaultAlignment(AlignmentFlag.AlignHCenter | AlignmentFlag.AlignVCenter);

    const hexVerticalHeader = hexTableInstance.verticalHeader();
    hexVerticalHeader.setVisible(false);

    // Interval for scroll synchronization
    setInterval(() => {
        const hexValue = hexTableInstance.verticalScrollBar().value();
        if (hexValue !== lastHexScrollValue) {
            renderVisibleRows();
            lastHexScrollValue = hexValue;
        }
    }, 50);

    // Function to handle copying hex
    const handleCopyHex = () => {
        if (selectionStartByteIndex !== null && selectionEndByteIndex !== null) {
            const startIndex = Math.min(selectionStartByteIndex, selectionEndByteIndex);
            const endIndex = Math.max(selectionStartByteIndex, selectionEndByteIndex);
            const selectedBytes = currentBuffer.slice(startIndex, endIndex + 1);

            const hexString = selectedBytes.toString('hex').match(/.{1,2}/g).join(' ').toUpperCase();

            const clipboard = QApplication.clipboard();
            if (clipboard) {
                clipboard.setText(hexString);
            }
        } else {
            console.log("No hay selección para copiar.");
        }
    };
    
    // New function to handle copying text with line breaks
    const handleCopyText = () => {
        if (selectionStartByteIndex !== null && selectionEndByteIndex !== null) {
            const startIndex = Math.min(selectionStartByteIndex, selectionEndByteIndex);
            const endIndex = Math.max(selectionStartByteIndex, selectionEndByteIndex);
            const selectedBytes = currentBuffer.slice(startIndex, endIndex + 1);
            
            let textToCopy = '';
            
            if (currentEncoding === 'SJIS') {
                textToCopy = EncodingModule.convert(selectedBytes, { to: 'UNICODE', from: 'SJIS', type: 'string' });
            } else {
                textToCopy = selectedBytes.toString('utf8');
            }

            const clipboard = QApplication.clipboard();
            if (clipboard) {
                clipboard.setText(textToCopy);
            }
        }
    };

    const CTRL_MODIFIER = 67108864;
    const C_KEY = 67;

    rootView.addEventListener(WidgetEventTypes.KeyPress, (e) => {
        const keyEvent = new QKeyEvent(e);
        if (keyEvent.key() === 16777248) {
            isShiftPressed = true;
        }
        if (keyEvent.modifiers() === CTRL_MODIFIER && keyEvent.key() === C_KEY) {
            handleCopyHex();
        }
    });

    rootView.addEventListener(WidgetEventTypes.KeyRelease, (e) => {
        const keyEvent = new QKeyEvent(e);
        if (keyEvent.key() === 16777248) {
            isShiftPressed = false;
        }
    });

    const selectRange = (startByte, endByte) => {
        clearSelection();
        if (!currentBuffer || startByte === null || endByte === null) {
            selectionStartByteIndex = null;
            selectionEndByteIndex = null;
            return;
        }

        let startIndex = Math.min(startByte, endByte);
        let endIndex = Math.max(startByte, endByte);
        
        let finalEndIndex = endIndex;
        if (currentEncoding === 'SJIS' && endIndex + 1 < currentBuffer.length) {
            const lastTwoBytes = currentBuffer.slice(endIndex, endIndex + 2);
            if (EncodingModule.detect(lastTwoBytes) === 'SJIS') {
                finalEndIndex++;
            }
        }
        
        selectionStartByteIndex = startIndex;
        selectionEndByteIndex = finalEndIndex;

        renderVisibleRows();
        updateStatusBar(startIndex, finalEndIndex);
    };
    
    const clearSelection = () => {
        selectionStartByteIndex = null;
        selectionEndByteIndex = null;
        renderVisibleRows();
    };

    const handleCellPressed = (row, col) => {
        if (!currentBuffer) return;
        const clickedByteIndex = getByteIndexFromRowCol(row, col);
        if (clickedByteIndex === -1) return;

        if (!isShiftPressed) {
            if (lastClickedCellByteIndex !== null) {
                selectRange(lastClickedCellByteIndex, clickedByteIndex);
            } else {
                selectRange(clickedByteIndex, clickedByteIndex);
            }
        } else {
            startByteIndexForClick = clickedByteIndex;
            selectRange(clickedByteIndex, clickedByteIndex);
            isSelectingByDragging = true;
        }
        lastClickedCellByteIndex = clickedByteIndex;
    };
    
    const handleCellEntered = (row, col) => {
        if (isSelectingByDragging && startByteIndexForClick !== null && isShiftPressed) {
            const currentByteIndex = getByteIndexFromRowCol(row, col);
            if (currentByteIndex !== -1) {
                selectRange(startByteIndexForClick, currentByteIndex);
            }
        }
    };

    const handleMouseRelease = () => {
        isSelectingByDragging = false;
        startByteIndexForClick = null;
    };

    hexTableInstance.addEventListener('cellPressed', (row, col) => handleCellPressed(row, col));
    hexTableInstance.addEventListener('cellEntered', (row, col) => handleCellEntered(row, col));
    hexTableInstance.addEventListener('mouseRelease', handleMouseRelease);

    hexTableInstance.addEventListener('wheelEvent', () => {
        isSelectingByDragging = false;
        lastClickedCellByteIndex = null;
        startByteIndexForClick = null;
        updateStatusBar(null, null);
    });

    rootView.setAcceptDrops(true);

    rootView.addEventListener(WidgetEventTypes.DragEnter, (e) => {
        const ev = new QDragMoveEvent(e);
        if (ev.mimeData().hasUrls()) {
            ev.accept();
        }
    });

    rootView.addEventListener(WidgetEventTypes.Drop, (e) => {
        const dropEvent = new QDropEvent(e);
        const fileUrls = dropEvent.mimeData().urls();
        if (fileUrls.length > 0) {
            const filePath = Os.platform() === "linux"
                ? fileUrls.at(0).toString().replace("file://", "")
                : fileUrls.at(0).toString().replace("file:///", "");
            
            setSelectedMainProgramFile(filePath);
            start();
            loadFileAndRender(filePath);
        }
    });
    
    selectAsStringButton.addEventListener('clicked', () => {
        const startIndex = selectionStartByteIndex;
        const endIndex = selectionEndByteIndex;
        
        if (startIndex !== null && endIndex !== null) {
            let postLastString = -1;
            const selectionEndByteIndex = Math.max(startIndex, endIndex);
            for (let i = selectionEndByteIndex + 1; i < currentBuffer.length; i++) {
                if (currentBuffer.at(i) !== 0x00) {
                    postLastString = i;
                    break;
                }
            }
            updateNeccesaryHexValues({firstString: toHexadecimal(startIndex), postLastString: toHexadecimal(postLastString)});
        } else {
            console.log("Not active selection.");
        }
    });

    selectAsStringPositionButton.addEventListener('clicked', () => {
        relocateStringPosition(selectionStartByteIndex,listWitgetObj.text)
    })
    
    selectAsPointerButton.addEventListener('clicked', () => {
        const startIndex = selectionStartByteIndex;
        const endIndex = selectionEndByteIndex;
        
        if (startIndex !== null && endIndex !== null) {
            const selectionEndByteIndex = Math.max(startIndex, endIndex);
            let nextAlignedOffset = Math.floor((selectionEndByteIndex + 1) / 4) * 4;
            if ((selectionEndByteIndex + 1) % 4 !== 0) {
                nextAlignedOffset += 4;
            }
            const postLastPointer = nextAlignedOffset < currentBuffer.length ? nextAlignedOffset : -1;
            
            updateNeccesaryHexValues({firstPointer: toHexadecimal(startIndex), postLastPointer: toHexadecimal(postLastPointer)});
        } else {
            console.log("Not active selection.");
        }
    });

    utf8ButtonInstance.addEventListener('clicked', setUTF8EncodingAndRender);
    shiftJISButtonInstance.addEventListener('clicked', setShiftJISEncodingAndRender);
    
    // Search logic modified to save and navigate results
    const searchHex = () => {
        hexSearchResults = [];
        currentHexResultIndex = -1;
        const hexString = hexSearchInput.text().replace(/\s/g, '');
        if (!hexString) return;
        
        const searchBytes = Buffer.from(hexString, 'hex');
        let offset = 0;
        while (offset < currentBuffer.length) {
            const foundIndex = currentBuffer.indexOf(searchBytes, offset);
            if (foundIndex !== -1) {
                hexSearchResults.push({ start: foundIndex, length: searchBytes.length });
                offset = foundIndex + searchBytes.length;
            } else {
                break;
            }
        }
        if (hexSearchResults.length > 0) {
            currentHexResultIndex = 0;
            showResult(hexSearchResults[currentHexResultIndex]);
        } else {
            console.log("Hex string not found.");
        }
    };

    const showResult = (result) => {
        selectRange(result.start, result.start + result.length - 1);
        const row = Math.floor(result.start / BYTES_PER_ROW);
        hexTableInstance.verticalScrollBar().setValue(row);
    };
    
    const navigateHexResults = (direction) => {
        if (hexSearchResults.length === 0) return;
        
        currentHexResultIndex = (currentHexResultIndex + direction + hexSearchResults.length) % hexSearchResults.length;
        showResult(hexSearchResults[currentHexResultIndex]);
    };
    
    const searchChar = () => {
        charSearchResults = [];
        currentCharResultIndex = -1;
        const textString = charSearchInput.text();
        if (!textString) return;

        let searchBytes;
        if (currentEncoding === 'SJIS') {
            searchBytes = Buffer.from(EncodingModule.convert(textString, { to: 'SJIS', type: 'array' }));
        } else {
            searchBytes = Buffer.from(textString, 'utf8');
        }
        
        let offset = 0;
        while (offset < currentBuffer.length) {
            const foundIndex = currentBuffer.indexOf(searchBytes, offset);
            if (foundIndex !== -1) {
                charSearchResults.push({ start: foundIndex, length: searchBytes.length });
                offset = foundIndex + searchBytes.length;
            } else {
                break;
            }
        }
        
        if (charSearchResults.length > 0) {
            currentCharResultIndex = 0;
            showResult(charSearchResults[currentCharResultIndex]);
        } else {
            console.log("Text not found.");
        }
    };
    
    const navigateCharResults = (direction) => {
        if (charSearchResults.length === 0) return;
        
        currentCharResultIndex = (currentCharResultIndex + direction + charSearchResults.length) % charSearchResults.length;
        showResult(charSearchResults[currentCharResultIndex]);
    };
    
    hexSearchButton.addEventListener('clicked', searchHex);
    hexPreviousButton.addEventListener('clicked', () => navigateHexResults(-1));
    hexNextButton.addEventListener('clicked', () => navigateHexResults(1));
    
    charSearchButton.addEventListener('clicked', searchChar);
    charPreviousButton.addEventListener('clicked', () => navigateCharResults(-1));
    charNextButton.addEventListener('clicked', () => navigateCharResults(1));

    statusBar.addWidget(lineInfoLabel);
    statusBar.addWidget(charPosLabel);
    statusBar.addWidget(selSizeLabel);
    statusBar.addWidget(encodingLabel);
    hexWindow.setStatusBar(statusBar);

    hexWindow.setWindowTitle('hexView - Loading file...');
    hexWindow.setCentralWidget(rootView);
    hexWindow.show();
    updateStatusBar(null, null);

    if (selectedFile) {
        loadFileAndRender(selectedFile);
    }

    return hexWindow;
}

// NEW FUNCTION TO UPDATE THE OFFSET LABEL
function updateOffsetLabel() {
    if (!currentBuffer || !offsetLabelInstance || !hexTableInstance) {
        offsetLabelInstance.setText('-');
        return;
    }
    const totalRows = Math.ceil(currentBuffer.length / BYTES_PER_ROW);
    const firstVisibleRow = hexTableInstance.verticalScrollBar().value();
    const lastVisibleRow = Math.min(firstVisibleRow + ROWS_TO_RENDER, totalRows - 1);

    let offsetText = ' \n\n';

    for (let row = firstVisibleRow; row <= lastVisibleRow; row++) {
        const offset = row * BYTES_PER_ROW;
        offsetText += offset.toString(16).toUpperCase().padStart(8, '0') + '\n\n';
    }
    
    offsetLabelInstance.setText(offsetText.trim());
}

let skipFirstByteOfNextRow = false;

function renderVisibleRows() {
    if (!currentBuffer || !hexTableInstance || !charLabelInstance) return;

    const hexTable = hexTableInstance;
    const firstVisibleRow = hexTable.verticalScrollBar().value();
    const lastVisibleRow = firstVisibleRow + ROWS_TO_RENDER;

    const totalRows = Math.ceil(currentBuffer.length / BYTES_PER_ROW);
    hexTable.setRowCount(totalRows);

    updateOffsetLabel();

    const rowHeight = hexTable.rowHeight(0);
    const charHeaderLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
    const charHeader = charHeaderLabels.join('');

    let charText = `<div style="background-color: white; color: black; font-family: 'MS GOTHIC', 'Courier New', Courier, monospace; font-size: 23px; white-space: pre;">`;
    charText += `<div style="height: ${hexTable.horizontalHeader().height()}px; line-height: ${hexTable.horizontalHeader().height()}px;">${charHeader}</div>`;

    for (let row = firstVisibleRow; row <= lastVisibleRow; row++) {
        let byteIndex = row * BYTES_PER_ROW;
        let charRow = '';
        let col = 0;

        while (col < BYTES_PER_ROW) {

            if (skipFirstByteOfNextRow && col === 0 && row > 0) {

                const byte = currentBuffer.at(byteIndex);
                if (byte !== undefined) {
                    const hexValue = byte.toString(16).toUpperCase().padStart(2, '0');
                    const hexItem = new QTableWidgetItem(hexValue);
                    hexItem.setTextAlignment(AlignmentFlag.AlignHCenter | AlignmentFlag.AlignVCenter);
                    
                    // We ensure that the selection remains visually consistent.
                    if (selectionStartByteIndex !== null && selectionEndByteIndex !== null) {
                        const startIndex = Math.min(selectionStartByteIndex, selectionEndByteIndex);
                        const endIndex = Math.max(selectionStartByteIndex, selectionEndByteIndex);
                        if (byteIndex >= startIndex && byteIndex <= endIndex) {
                            hexItem.setBackground(SelectedColor);
                        } else {
                            hexItem.setBackground(DefaultColor);
                        }
                    } else {
                        hexItem.setBackground(DefaultColor);
                    }
                    hexTable.setItem(row, col, hexItem);
                }

                // We added NOTHING to the character view.
                charRow += ''; 

                // We advance the counters and reset the flag.
                col++;
                byteIndex++;
                skipFirstByteOfNextRow = false;
                continue; // Next column in the row.
            }

            if (byteIndex >= currentBuffer.length) {
                charRow += ' ';
                hexTable.setItem(row, col, new QTableWidgetItem());
                col++;
                byteIndex++;
                continue;
            }

            const byte = currentBuffer.at(byteIndex);
            const hexValue = byte.toString(16).toUpperCase().padStart(2, '0');
            let charValue = '';
            let span = 1;

            if (currentEncoding === 'SJIS' && byteIndex + 1 < currentBuffer.length) {
                const charBytes = currentBuffer.slice(byteIndex, byteIndex + 2);
                if (EncodingModule.detect(charBytes) === 'SJIS') {
                    charValue = EncodingModule.convert(charBytes, { to: 'UNICODE', from: 'SJIS', type: 'string' });
                    span = 2;
                    if (col === BYTES_PER_ROW - 1) {
                        skipFirstByteOfNextRow = true;
                    }
                }
            }
            
            if (span === 1) {
                if (byte === 0x00 || byte === 0x0A || byte === 0x0D) {
                    charValue = ' ';
                } else if (currentEncoding === 'SJIS') {
                    charValue = EncodingModule.convert(currentBuffer.slice(byteIndex, byteIndex + 1), { to: 'UNICODE', from: 'SJIS', type: 'string' });
                    const charCode = charValue.charCodeAt(0);
                    charValue = (charCode >= 32 && charCode <= 126) ? charValue : '.';
                } else {
                    charValue = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
                }
            }

            const hexItem = new QTableWidgetItem();
            hexItem.setText(hexValue);
            hexItem.setTextAlignment(AlignmentFlag.AlignHCenter | AlignmentFlag.AlignVCenter);
            if (hexValue === '00') {
                hexItem.setFont(boldFont);
            }
            hexTable.setItem(row, col, hexItem);
            
            if (selectionStartByteIndex !== null && selectionEndByteIndex !== null) {
                const startIndex = Math.min(selectionStartByteIndex, selectionEndByteIndex);
                const endIndex = Math.max(selectionStartByteIndex, selectionEndByteIndex);
                if (byteIndex >= startIndex && byteIndex <= endIndex) {
                    hexItem.setBackground(SelectedColor);
                } else {
                    hexItem.setBackground(DefaultColor);
                }
            } else {
                hexItem.setBackground(DefaultColor);
            }

            if (byte === 0x0A) {
                charValue = ' ';
            } else if (byte < 32 || byte === 127) {
                charValue = '.';
            }
            
            let escapedChar = charValue.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            if (span === 2) {
                charRow += escapedChar;  
                charRow += '';
                
                const nextByte = currentBuffer.at(byteIndex + 1);
                const nextHexValue = nextByte.toString(16).toUpperCase().padStart(2, '0');
                const hexItemNext = new QTableWidgetItem();
                hexItemNext.setText(nextHexValue);
                hexItemNext.setTextAlignment(AlignmentFlag.AlignHCenter | AlignmentFlag.AlignVCenter);

                if (selectionStartByteIndex !== null && selectionEndByteIndex !== null) {
                    const startIndex = Math.min(selectionStartByteIndex, selectionEndByteIndex);
                    const endIndex = Math.max(selectionStartByteIndex, selectionEndByteIndex);
                    if ((byteIndex + 1) >= startIndex && (byteIndex + 1) <= endIndex) {
                        hexItemNext.setBackground(SelectedColor);
                    } else {
                        hexItemNext.setBackground(DefaultColor);
                    }
                } else {
                    hexItemNext.setBackground(DefaultColor);
                }

                if (col + 1 < BYTES_PER_ROW) {
                    hexTable.setItem(row, col + 1, hexItemNext);
                }

                col += 2;
                byteIndex += 2;
            } else {
                charRow += escapedChar;
                col++;
                byteIndex++;
            }
        }
        charText += `<div style="height: ${rowHeight}px; line-height: ${rowHeight}px;">${charRow}</div>`;
    }
    charText += `</div>`;
    charLabelInstance.setText(charText);
}

function renderHexView() {
    if (!currentBuffer || !hexTableInstance || !charLabelInstance) return;
    
    const numRows = Math.ceil(currentBuffer.length / BYTES_PER_ROW);
    hexTableInstance.setRowCount(numRows);
    
    renderVisibleRows();
}

function shutdownHexView(){
    if(hexWindowInstance){
      hexWindowInstance.close()
    }

    hexWindowInstance = null
    currentBuffer = null
}

const toHexadecimal = (number) => {
    if (number === null || number === undefined || number === -1) {
        return "null";
    }
    let hexString = number.toString(16).toUpperCase();
    if (hexString.length % 2 !== 0) {
        hexString = '0' + hexString;
    }
    return hexString;
};

module.exports = {
    hexView,
    currentEncoding,
    hexViewBuffer: currentBuffer,
    setUTF8EncodingAndRender,
    setShiftJISEncodingAndRender,
    shutdownHexView,
    toHexadecimal
};