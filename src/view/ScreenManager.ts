// screen-manager: manages rendering, updation and switching of screens

import process from "node:process";
import { BaseScreen } from "./screens/Base";
import { MainScreen } from "./screens/main";
import { SettingScreen } from "./screens/settings";
import { _keys, clearVisibleScreen, disableCursor, enableCursor } from "../utils/io";
import EventBus from "../utils/eventBus";
import { ResultScreen } from "./screens/result";
import chalky from "../utils/Chalky";
import { checkStore, createDefaultStore, fetchFromStoreJSON } from "../utils/store";


// stdin and stdout configure
process.stdin.setRawMode(true)
process.stdin.setEncoding("utf-8")
disableCursor()
process.stdin.resume()


// SM - ScreenManager
export class SM {
    private eventHandler = new EventBus();
    private screensList : {id: string, screen: BaseScreen}[] = [];
    private intervalRunning : null | NodeJS.Timeout
    private currentScreen: BaseScreen | null = null;
    private currentScreenId: string | null = null
    private isCleanRenderingRequired : boolean = false
    
    constructor(){
        process.stdout.write("\x1b[3J\x1b[2J\x1b[H"); // clear scrollback buffer + clear visible screen and
        if (!checkStore()) {
            try {
                createDefaultStore();
            } catch (error) {
                this.eventHandler.emit("closeAppOnError", error)
            }
        }else{
            fetchFromStoreJSON() // globalStore
        }
        this.screensList = [
            {id: "main", screen:  new MainScreen({eventHandler: this.eventHandler})},
            {id: "setting", screen: new SettingScreen({eventHandler: this.eventHandler})},
            {id: "result", screen: new ResultScreen({eventHandler: this.eventHandler})}
        ]
        this.currentScreenId = "main"
        this.currentScreen = this.screensList[0].screen
        this.intervalRunning = null


        this.eventHandler.on(
            "displayResult", (data)=>{
                (this.screensList[2].screen as ResultScreen)?.setResultData(data)
                this.switchScreen("result")
            }
        )

        this.eventHandler.on(
            "closeAppOnError", (errorMessage: string)=>{
                if(this.intervalRunning){
                    clearInterval(this.intervalRunning)
                    this.intervalRunning = null
                    clearVisibleScreen()
                    process.stdout.cursorTo(0,0)
                    console.log(
                        `
                            ${chalky.red("App closed due to error.")}\n

                            ${chalky.bgRed.white("Error:", )}\n

                            ${errorMessage}
                        `
                    )
                    process.exit(1)
                }
            }
        )
    }
    keyHandle(k: string){
        switch(k){
            case _keys.ctrl_c: 
                enableCursor();
                clearVisibleScreen()
                if(this.intervalRunning) clearInterval(this.intervalRunning);
                process.exit();
            case _keys.ctrl_t: 
                this.switchScreen("main")
                break
            case _keys.ctrl_s:
                this.switchScreen("setting")
                break
            default:
                this.currentScreen?.keyHandle(k)
        }
    }
    handleScreenResize(){
        // width = no of columns . height = no of rows , available in terminalDimension
        this.isCleanRenderingRequired = true
        this.currentScreen?.resizeScreen()
        this.screensList.forEach(screenData=>{
            if(this.currentScreenId!=screenData.id){
                screenData.screen.resizeScreen()
            }
        })
    }
    private switchScreen(newScreenId: string){
        if(this.currentScreenId != newScreenId){
            const nsIndex = this.screensList.findIndex(x=>x.id==newScreenId)
            if(nsIndex!=-1){
                this.currentScreenId = newScreenId
                this.currentScreen = this.screensList[nsIndex].screen;
                this.isCleanRenderingRequired = true
                this.currentScreen.refresh()
            }
        }
    }
    setFPS (fps:number){
        this.currentScreen?.setFPS(fps)
    }
    update(){
        if(this.currentScreen){
            this.currentScreen.update();
        }
    }
    render(){
        if(this.currentScreen){
            this.currentScreen.render(this.isCleanRenderingRequired); // do clean rendering if just switched
            if(this.isCleanRenderingRequired) this.isCleanRenderingRequired = false;
        }
    }
}