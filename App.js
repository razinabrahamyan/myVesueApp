import React, {Fragment} from 'react';
import 'react-native-gesture-handler';
import {Image, Modal, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, StatusBar, ScrollView, RefreshControl,PermissionsAndroid} from 'react-native';
import {defaultApi} from './axios';
import AsyncStorage from '@react-native-community/async-storage';
import firebase from 'react-native-firebase';
import { WebView } from 'react-native-webview';
import RNBootSplash from 'react-native-bootsplash';
import Geolocation from 'react-native-geolocation-service';
import DeviceInfo from "react-native-device-info";
import NetInfo from "@react-native-community/netinfo";

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            invitationVisibility:false,
            joinAttemptVisibility: false,
            driverApprovedVisibility: false,
            driverCanceledVisibility: false,
            image: '',
            isOffline:true,
            checkoutVisibility:false,
            notification_id:null,
            location: '',
            fcm_token: null,
            lat: null,
            lng: null,
            showSpinner: true,
            user_id: null,
            ride_id: null,
            url: null,
            title: '',
            body: '',
            brand: '',
            enablePTR: false,
            key: 1,
            refreshing: false,
            notFirstAttempt:false
        };
    }
    redirectUrl = '';
    notificationOpen = '';
    componentDidMount() {
        this.checkConnection();
        this.notificationOpen = '';
        this.init().finally(() => {
            // without fadeout: RNBootSplash.hide()
            RNBootSplash.hide({ duration: 50 });
        });
        setInterval(this.getLivePosition, 10000);
        this.getPosition();
        this.getToken();
        DeviceInfo.getDeviceName().then(res => setDeviceName(res));
        this.setState({
            brand: DeviceInfo.getBrand()
        })
        this.checkPermission();
        this.createNotificationListeners();
        firebase.notifications().removeAllDeliveredNotifications();
    }

    componentWillUnmount() {
        clearInterval();
        this.removeNotificationListeners();
    }
    getPosition = async () => {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (granted === PermissionsAndroid.RESULTS.GRANTED){
            try{
                await Geolocation.getCurrentPosition(position => {
                    if(position && position.coords) {
                        this.setState({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        })
                    }
                },error => {

                },{enableHighAccuracy:true})
            }catch (exception) {
                await Geolocation.getCurrentPosition(position => {
                    if(position && position.coords) {
                        this.setState({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                        })
                    }
                },error => {

                },{enableHighAccuracy:false})
            }
        }

    };

    getLivePosition = () => {
        const grantedLive = PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if(grantedLive){
            try{
                Geolocation.getCurrentPosition(position => {
                    if(position && position.coords) {
                        this.startRequest({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            fcm_token: this.state.fcm_token
                        }, 'setLocation')
                    }
                },error => {

                },{enableHighAccuracy:true})
            }catch (exception) {
                Geolocation.getCurrentPosition(position => {
                    if(position && position.coords) {
                        this.startRequest({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            fcm_token: this.state.fcm_token
                        }, 'setLocation')
                    }
                },error => {

                },{enableHighAccuracy:false})
            }

        }

    };

    sendDebug = (debug) => {
        this.startRequest(debug, 'setDebug');
    }
    getToken = async () => {
        let fcmToken = await AsyncStorage.getItem('fcmToken');
        if(fcmToken)  {
            this.setState({
                fcm_token: fcmToken
            })
        }
        if (!fcmToken) {
            fcmToken = await firebase.messaging().getToken();
            if (fcmToken) {
                this.setState({
                    fcm_token: fcmToken
                });
                await AsyncStorage.setItem('fcmToken', fcmToken);
            }
        }
    };
    checkConnection = async () => {
        const Connection = await NetInfo.addEventListener(state => {
            if(state.isConnected){
                this.setState({
                    isOffline:false,
                    notFirstAttempt:true
                })
            }else{
                this.setState({
                    isOffline:true,
                    notFirstAttempt:true
                })
            }
        });
    };
    checkPermission = async () => {
        const enabled = await firebase.messaging().hasPermission();
        if (enabled) {
            this.getToken();
        } else {
            this.requestPermission();
        }
    };

    requestPermission = async () => {
        try {
            await firebase.messaging().requestPermission();
            this.getToken();
        } catch (error) {
        }
    };

    removeNotificationListeners = () => {
        this.onUnsubscribeNotificaitonListener();
        this.notificationOpen = null;
    };

    async init() {

    }

    showSpinner() {
        this.setState({ showSpinner: true });
    }

    hideSpinner() {
        this.setState({ showSpinner: false });
    }

    refresh(ref) {
        ref && ref.reload();
        this.setState({
            refreshing: false
        })
    }

    createNotificationListeners = async () => {
        this.onUnsubscribeNotificaitonListener = firebase
            .notifications()
            .onNotification(notification => {
                if (notification) {
                    if(notification._data && notification._data && notification._data.role && notification._body && notification._title) {
                        this.setState({
                            body: notification._body,
                            title: notification._title,

                        });
                        if(notification._data.role === 'join_attempt' && notification._data.notification_id){
                            this.setState({
                                joinAttemptVisibility: true,
                                notification_id:notification._data.notification_id,
                                user_id: notification._data.user_id,
                                ride_id: notification._data.ride_id,
                                image:notification._data.image
                            })
                        }
                        else if(notification._data.role === 'driver_approved' && notification._data.redirect_url && notification._data.notification_id) {
                            this.redirectUrl = notification._data.redirect_url;
                            this.setState({
                                notification_id:notification._data.notification_id,
                                driverApprovedVisibility: true,
                                ride_id: notification._data.ride_id,
                            })
                        }
                        else if(notification._data.role === 'driver_canceled' && notification._data.redirect_url && notification._data.notification_id) {
                            this.redirectUrl = notification._data.redirect_url;
                            this.setState({
                                notification_id:notification._data.notification_id,
                                driverCanceledVisibility: true,
                            })
                        }
                        else if(notification._data.role === 'passenger_checkout' && notification._data.redirect_url){
                            this.redirectUrl = notification._data.redirect_url;
                            this.setState({
                                checkoutVisibility: true,
                            })
                        }
                        else if(notification._data.role === 'passenger_paid' && notification._data.redirect_url){
                            this.setState({
                                url: notification._data.redirect_url,
                            })
                        }
                        else if(notification._data.role === 'invitation' && notification._data.redirect_url){
                            this.redirectUrl = notification._data.redirect_url;
                            this.setState({
                                invitationVisibility: true,
                            })
                        }
                    }
                }
                firebase.notifications().displayNotification(notification);
            });
        //if closed
        this.notificationOpen = await firebase.notifications().getInitialNotification();
        if (this.notificationOpen) {
            console.log('if closed')
            let notification = this.notificationOpen.notification._data;
            if(notification.role === 'join_attempt'){
                this.setState({
                    joinAttemptVisibility: true,
                    notification_id:notification.notification_id,
                    user_id: notification.user_id,
                    ride_id: notification.ride_id,
                    body: notification.body,
                    title: notification.title,
                    image:notification.image
                })
            }else if(notification.role === 'driver_approved'){
                this.redirectUrl = notification.redirect_url;
                this.setState({
                    notification_id:notification.notification_id,
                    driverApprovedVisibility: true,
                    ride_id: notification.ride_id,
                    body: notification.body,
                    title: notification.title
                })
            }else if(notification.role === 'driver_canceled'){
                this.redirectUrl = notification.redirect_url;
                this.setState({
                    notification_id:notification.notification_id,
                    driverCanceledVisibility: true,
                    body: notification.body,
                    title: notification.title
                })
            }else if(notification.role === 'passenger_checkout'){
                this.redirectUrl = notification.redirect_url;
                this.setState({
                    checkoutVisibility: true,
                    body: notification.body,
                    title: notification.title
                })
            }else if(notification.role === 'invitation'){
                this.redirectUrl = notification.redirect_url;
                this.setState({
                    invitationVisibility: true,
                    body: notification.body,
                    title: notification.title
                })
            }else if(notification.role === 'message'){
                this.setState({
                    url: notification.redirect_url
                })
            }
            firebase.notifications().removeAllDeliveredNotifications();
            this.notificationOpen = null;
        }
    };

    render() {
        const {notFirstAttempt,isOffline,image,invitationVisibility, checkoutVisibility, joinAttemptVisibility, driverApprovedVisibility,driverCanceledVisibility, fcm_token, lat, lng, brand, url, title, body, refreshing } = this.state;
        const api = url ? `https://myvesu.aurosystem.com/${url}` : `https://myvesu.aurosystem.com/start?fcm_token=${fcm_token}&lat=${lat}&lng=${lng}&brand=${brand}`;
        console.log(api, "api");
        let WebViewRef;
        if (notFirstAttempt) {
            if(isOffline){
                return (
                    <Modal
                        visible={true}
                        transparent={true}
                        onRequestClose={() => {
                            this.cancelAlertBox('isOfflineVisibility')
                        }}>
                        <TouchableOpacity style={{height: '100%',padding:10}} activeOpacity={1}
                                          onPress={() => this.cancelAlertBox('driverApprovedVisibility')}>
                            <View style={[styles.MainView, {backgroundColor: 'white'}]}>

                                <TouchableOpacity style={[styles.MainAlertView, {width: '90%'}]} activeOpacity={1}
                                                  onPress={() => console.log('div press')}>
                                    <Image
                                        source={require('./icons/no_connection.png')}
                                        style={styles.CongratImage}
                                    />
                                    <Text style={styles.AlertHeading}> No Connection</Text>
                                    <Text style={[styles.AlertMessage]}>Connection is required !
                                        Check your internet connection and try again
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </Modal>
                )
            }
            return (
                <View
                    style={this.state.showSpinner === true ? styles.stylOld : styles.styleNew}>
                    <StatusBar
                        translucent
                        backgroundColor="transparent"
                        barStyle="light-content"
                    />
                    {this.state.showSpinner ? (
                        <ActivityIndicator
                            color="#F7941D"
                            size="large"
                            style={styles.ActivityIndicatorStyle}
                        />
                    ) : null}
                    {/*Passenger******/}

                    <WebView
                        source={{uri: api}}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        onLoadStart={() => this.showSpinner()}
                        onLoadEnd={() => this.hideSpinner()}
                        ref={(WEBVIEW_REF) => {
                            WebViewRef = WEBVIEW_REF
                        }}
                        injectedJavaScript="setTimeout(() => {document.addEventListener('scroll', function (event) {window.ReactNativeWebView.postMessage(JSON.stringify(document.getElementsByClassName('topconteiner')[0].scrollTop));},true);}, 300);true;"
                    />

                    <Modal
                        visible={joinAttemptVisibility}
                        transparent={true}
                        onRequestClose={() => {
                            this.cancelAlertBox('joinAttemptVisibility')
                        }}>
                        <TouchableOpacity style={{height: '100%'}} activeOpacity={1}
                                          onPress={() => this.cancelAlertBox('joinAttemptVisibility')}>
                            <View style={[styles.MainView]}>

                                <TouchableOpacity style={[styles.MainAlertView]} activeOpacity={1}
                                                  onPress={() => console.log('div press')}>
                                    <Text style={styles.AlertHeading}> {title}</Text>
                                    <View style={{flexDirection: 'row'}}>

                                        <View style={{flex: 2, alignContent: 'center', flexDirection: 'column'}}>
                                            <Image
                                                source={{uri: image}}
                                                style={styles.UserImage}
                                            />
                                        </View>
                                        <View style={{flex: 6}}>

                                            <Text style={[styles.JoinAlertMessage]}>{body}</Text>
                                        </View>

                                    </View>


                                    <View style={styles.DoubleButtonDiv}>

                                        <TouchableOpacity style={styles.buttonStyle}
                                                          onPress={() => this.sendAnswer('approve')}
                                                          activeOpacity={0.7}>
                                            <View style={styles.TextCenter}>
                                                <Text style={styles.TextStyle}>ALLOW</Text>
                                            </View>
                                        </TouchableOpacity>

                                        <View style={styles.VerticalLine}/>

                                        <TouchableOpacity style={styles.buttonStyle}
                                                          onPress={() => this.sendAnswer('cancel')} activeOpacity={0.7}>
                                            <View style={styles.TextCenter}>
                                                <Text style={styles.TextStyle}>CANCEL</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </Modal>

                    <Modal
                        visible={driverApprovedVisibility}
                        transparent={true}
                        onRequestClose={() => {
                            this.cancelAlertBox('driverApprovedVisibility')
                        }}>
                        <TouchableOpacity style={{height: '100%'}} activeOpacity={1}
                                          onPress={() => this.cancelAlertBox('driverApprovedVisibility')}>
                            <View style={[styles.MainView]}>

                                <TouchableOpacity style={[styles.MainAlertView]} activeOpacity={1}
                                                  onPress={() => console.log('div press')}>
                                    <Text style={styles.AlertHeading}> {title}</Text>
                                    <Text style={[styles.AlertMessage]}>  {body}</Text>
                                       <View style={styles.DoubleButtonDiv}>

                                        <TouchableOpacity style={styles.buttonStyle}
                                                          onPress={() => this.sendSeenRequest('driverApprovedVisibility')}
                                                          activeOpacity={0.7}>
                                            <View style={styles.TextCenter}>
                                                <Text style={styles.TextStyle}>OK</Text>
                                            </View>
                                        </TouchableOpacity>

                                        <View style={styles.VerticalLine}/>

                                        <TouchableOpacity style={styles.buttonStyle}
                                                          onPress={() => this.redirectToPage(this.redirectUrl, 'driverApprovedVisibility')}
                                                          activeOpacity={0.7}>
                                            <View style={styles.TextCenter}>
                                                <Text style={styles.TextStyle}>SEE</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </Modal>

                    <Modal
                        visible={driverCanceledVisibility}
                        transparent={true}
                        animationType={"fade"}
                        onRequestClose={() => {
                            this.cancelAlertBox('driverCanceledVisibility')
                        }}>
                        <TouchableOpacity style={{height: '100%'}} activeOpacity={1}
                                          onPress={() => console.log('background press')}>
                            <View style={styles.MainView}>
                                <TouchableOpacity style={[styles.MainAlertView]} activeOpacity={1}
                                                  onPress={() => console.log('div press')}>
                                    <View style={styles.MainImageDiv}>
                                        <Image
                                            source={require('./icons/goodIkNew.png')}
                                            style={styles.CongratImage}
                                        />
                                    </View>
                                    <Text style={styles.AlertMessage}> {body} </Text>
                                    <View style={{flexDirection: 'row'}}>
                                        <TouchableOpacity
                                            style={[styles.buttonStyle, styles.SingleButtonStyle]}
                                            onPress={() => {
                                                this.sendSeenRequest('driverCanceledVisibility')
                                            }} activeOpacity={0.7}
                                        >
                                            <Text style={styles.TextStyle}> OK </Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>

                    </Modal>


                    <Modal
                        visible={invitationVisibility}
                        transparent={true}
                        animationType={"fade"}
                        onRequestClose={() => {
                            this.cancelAlertBox('invitationVisibility')
                        }}>
                        <TouchableOpacity style={{height: '100%'}} activeOpacity={1}
                                          onPress={() => this.cancelAlertBox('invitationVisibility')}>
                            <View style={styles.MainView}>
                                <TouchableOpacity style={[styles.MainAlertView]} activeOpacity={1}
                                                  onPress={() => console.log('div press')}>
                                    <View style={styles.MainImageDiv}>
                                        <Image
                                            source={require('./icons/goodIkNew.png')}
                                            style={styles.CongratImage}
                                        />
                                    </View>
                                    <Text style={styles.AlertMessage}> {body} </Text>
                                    <View style={{flexDirection: 'row'}}>
                                        <TouchableOpacity
                                            style={[styles.buttonStyle, styles.SingleButtonStyle]}
                                            onPress={() => {
                                                this.redirectToPage(this.redirectUrl, 'invitationVisibility')
                                            }} activeOpacity={0.7}
                                        >
                                            <Text style={styles.TextStyle}> SEE </Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>

                    </Modal>
                    <Modal
                        visible={checkoutVisibility}
                        transparent={true}
                        animationType={"fade"}
                        onRequestClose={() => {
                            this.cancelAlertBox('checkoutVisibility')
                        }}>

                        <TouchableOpacity style={{height: '100%'}} activeOpacity={1}
                                          onPress={() => this.cancelAlertBox('checkoutVisibility')}>
                            <View style={styles.MainView}>
                                <TouchableOpacity style={[styles.MainAlertView]} activeOpacity={1}
                                                  onPress={() => console.log('div press')}>
                                    <View style={styles.MainImageDiv}>
                                        <Image
                                            source={require('./icons/goodIkNew.png')}
                                            style={styles.CongratImage}
                                        />
                                    </View>
                                    <Text style={styles.AlertMessage}>{body} </Text>
                                    <View style={{flexDirection: 'row'}}>
                                        <TouchableOpacity
                                            style={[styles.buttonStyle, styles.SingleButtonStyle]}
                                            onPress={() => {
                                                this.redirectToPage(this.redirectUrl, 'checkoutVisibility')
                                            }} activeOpacity={0.7}
                                        >
                                            <Text style={styles.TextStyle}> CHECKOUT </Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </Modal>

                </View>
            );
        }
        return (
            <Text> </Text>
        )

    }
    startRequest = (params, url) => {
        defaultApi(url, 'POST', params).then(res => {
            if(res && res.data && res.data.redirect_url) {
                this.setState({
                    url: res.data.redirect_url
                })
            }
        })
    };
    redirectToPage(redirect_url,modal){
        this.setState({
            url:redirect_url
        });
        this.sendSeenRequest(modal);
    }

    sendAnswer(answer) {
        this.cancelAlertBox('joinAttemptVisibility');
        this.startRequest({
            user_id: this.state.user_id,
            ride_id: this.state.ride_id,
            answer: answer,
            notification_id:this.state.notification_id
        }, 'approve-request')
    }

    sendSeenRequest(modal = null){
        if(modal){
            this.cancelAlertBox(modal);
        }
        defaultApi('notification-seen', 'POST', {
            notification_id:this.state.notification_id,
            title:'notification seen'
        }).then();
    }

    cancelAlertBox(type,WebView = null) {
        if(type === 'joinAttemptVisibility'){
            this.setState({
                joinAttemptVisibility: false
            })
        }
        else if(type === 'driverApprovedVisibility'){
            this.setState({
                driverApprovedVisibility: false
            })
        }else if(type === 'driverCanceledVisibility'){
            this.setState({
                driverCanceledVisibility: false
            })
        }
        else if(type === 'checkoutVisibility'){
            this.setState({
                checkoutVisibility: false
            })
        }
        else if(type === 'invitationVisibility'){
            this.setState({
                invitationVisibility: false
            })
        }
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        // margin: 20
    },
    MainAlertView: {
        paddingTop:20,
        padding: 15,
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: "#F7941D",
        //opacity: 0.9,
        width: 'auto',
        borderColor: '#fff',
        borderRadius: 15,
    },
    DoubleButtonDiv: {
        borderColor: 'white',
        flexDirection: 'row',
        alignItems:'center',
        borderTopWidth: 0.5,
        marginTop:20,
        height:56,
        paddingTop:8
    },
    MainImageDiv: {
        flexDirection: 'row',
        marginTop: 0
    },
    CongratImage:{
        width: 100,
        height: 100
    },
    UserImage:{
        width: 70,
        height: 70,
        borderRadius:5,
        marginTop:15
    },
    SingleButtonStyle: {
        marginTop: 25,
        borderColor:'white',
        borderWidth:2,
        borderRadius: 30,
        padding: 10,
        marginBottom:20,
    },
    TextCenter: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    VerticalLine: {
        width: 0.5,
        height: 50,
        backgroundColor: '#fff',
    },
    MainView:{
        flex: 1,
        alignItems: 'center',
        padding: 30,
        paddingTop:60,
        backgroundColor: 'rgba(255, 255, 255, 0.6)'
    },
    AlertTitle: {
        fontSize: 22,
        color: "#fff",
        textAlign: 'center',
        padding: 10,
        height: '28%'
    },
    AlertHeading:{
        color: "#fff",
        textAlign: 'center',
        marginTop: 10,
        fontSize: 20,
    },
    AlertMessage: {
        fontSize: 17,
        color: "#fff",
        marginTop: 15,
        textAlign: 'center',
    },
    JoinAlertMessage:{
        fontSize: 17,
        color: "#fff",
        marginTop: 15,
        textAlign: 'left',
        paddingLeft:5
    },
    buttonStyle: {
        width: '50%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    TextStyle: {
        color: '#fff',
        textAlign: 'center',
        fontSize: 20,
    },
    stylOld: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    styleNew: {
        flex: 1,
    },
    WebViewStyle: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
        marginTop: 40,
    },
    ActivityIndicatorStyle: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
    }
});

export default App;
