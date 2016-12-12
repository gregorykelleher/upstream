(function(){
	angular
	.module('main')
	.controller('dashboard_controller', [dashboard_controller]);

	function dashboard_controller() {
		var self = this;
		self.weather = weather;
		self.map = map;
		self.messaging = messaging;

		/* Weather Display Function */

		function weather($scope) {

			$scope.day = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][(new Date()).getDay()];

			$.getJSON("https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20weather.forecast%20where%20woeid%20%3D%20561669%20and%20u%3D%27c%27&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys").then(function(wd) {
				$scope.location = "Maynooth";
				$scope.weather = (wd.query.results.channel.item.condition.code).toString();
				$scope.temp = (wd.query.results.channel.item.condition.temp).toString().split('.')[0] + "°C";

				switch ($scope.weather) {
					case "10":
					case "11":
					case "12":
					$scope.img = "/app/imgs/rain.svg";
					break;
					case "8":
					case "9":
					$scope.img = "/app/imgs/rain.svg";
					break;
					case "26":
					case "27":
					case "28":
					case "29":
					case "30":
					case "20":
					$scope.img = "/app/imgs/clouds.svg";
					break;
					case "31":
					case "32":
					case "33":
					case "34":
					case "36":
					case "27":
					$scope.img = "/app/imgs/clear.svg";
					break;
					case "5":
					case "6":
					case "7":
					case "13":
					case "14":
					case "15":
					case "16":
					case "17":
					case "41":
					case "42":
					case "43":
					case "46":
					$scope.img = "/app/imgs/snow.svg";
					break;
					case "3":
					case "4":
					case "37":
					case "38":
					case "39":
					case "40":
					$scope.img = "/app/imgs/thunderstorm.svg";
					break;
					default:
					$scope.img = "/app/imgs/error.svg";
				}
			});
		};

		/* Map Display Function */

		function map($scope, NgMap, $firebaseArray, Data) {

			// add map to scope
			NgMap.getMap().then(function(map) {
				$scope.map = map;
			});

			// pull location data from firebase
			$scope.locations = $firebaseArray(Data.child('locations'));

			$scope.addMarker = function(item) {
				
				// display marker and info window
				$scope.location = item;
				$scope.map.showInfoWindow('info', 'marker');

				// dynamic map re-centering
				var coords = new google.maps.LatLng(item.coords.lat, item.coords.lng);
				$scope.map.panTo(coords);

			}
		};

		/* Messaging Display Function */

		function messaging($scope, $firebaseArray, $firebaseObject, $timeout, Data, Auth) {

			$scope.current_user_id = Auth.$getAuth().uid;

			$scope.rooms = $firebaseArray(Data.child('users'));
			$scope.users = [];

			// remove current user from list; for display purposes only
			$scope.rooms.$loaded()
			.then(function(){
				angular.forEach($scope.rooms, function(user, uid) {
					uid = $scope.current_user_id;
					if (user.id != uid) {
						$scope.users.push(user);
					}
				});
			});

			// set up tab configurations
			var tabs = [{ title: 'Contacts', content: $scope.rooms}],
			selected = null,
			previous = null;
			$scope.tabs = tabs;
			$scope.contacts=tabs[0];
			$scope.selectedIndex = 0;
			$scope.tab_state = false;

			// change tab state for ng-show in DOM
			$scope.changeTabState = function(bool) { $scope.tab_state = bool; }

			$scope.openMessaging = function(item) { 

				//capture recipient when message tab opened
				$scope.recipient = item.first_name + " " + item.last_name;
				$scope.recipient_id = item.id;

				// create rooms node in firebase
				var rooms = $firebaseArray(Data.child("rooms"));

				// create room_metadata in firebase
				var room_metadata = $firebaseArray(Data.child("room_metadata"));
				
				// check whether room previously created; if not, create
				rooms.$loaded().then(function(){
					var bool = false;
					Data.child('rooms').once('value', function(snapshot) {
						snapshot.forEach(function(itemSnapshot) {
							$scope.data = itemSnapshot.val();
							// FALSE IFF (current user OR recipient) is (initiator OR recipient)
							if (($scope.current_user_id === $scope.data.initiator && $scope.recipient_id === $scope.data.recipient)) { 
								bool = true;
							}
							else if (($scope.recipient_id === $scope.data.initiator) && ($scope.current_user_id === $scope.data.recipient)) {
								bool = true;
							}
						});
						// add room to firebase if conditions satisfied
						if (!bool) {
							rooms.$add({
								initiator: $scope.current_user_id,
								recipient: $scope.recipient_id
							}).then(function(ref) {
								// add room_id to scope - note available for initiator
								$scope.room_id = ref.key;
							});
						}
					});
				}).catch(function(error) {
					console.error("Error:", error);
				});	

				function sendMessage(message) {

					room_metadata.$loaded().then(function(){

						Data.child('users').child($scope.current_user_id).once('value', function(snap) {
							var item = snap.val();
							$scope.current_user_name = item.first_name + " " + item.last_name;

							Data.once('value', function(snapshot) {

								room_metadata.$add({
									sender: $scope.current_user_name,
									receiver: $scope.recipient,
									message: message

								})
							});
						});
					}).catch(function(error) {
						console.error("Error:", error);
					});	

				}

				$scope.message = { text: null };

				// validation done in DOM - submit() posts message to firebase & clears input
				$scope.submit = function(form) {
					if ($scope.message.text) {

						sendMessage($scope.message.text);

						$scope.message.text = '';
						form.$setPristine();
						form.$setUntouched();

					}
				};

				var messages = $firebaseObject(Data.child('room_metadata'));
				$scope.message_objs = [];

				messages.$loaded()
				.then(function() {
					Data.child('room_metadata').on('child_added', function(data) {
						Data.child('users').child($scope.current_user_id).once('value', function(snap) {
							var item = snap.val();
							$scope.current_user_name = item.first_name + " " + item.last_name;

							if (($scope.current_user_name == data.val().sender) && ($scope.recipient == data.val().receiver)) { 
								$scope.message_objs.push(data.val());
							}
							else if (($scope.recipient === data.val().sender) && ($scope.current_user_name === data.val().receiver)) {
								$scope.message_objs.push(data.val());
							}
						});
					});
				}).catch(function(error) {
					console.error("Error:", error);
				});	

				console.log($scope.message_objs);

				
				// dynamic user chat tab
				if ($scope.tabs.length == 1) {
					$scope.tabs.push({ title: $scope.recipient, content: $scope.message_objs, disabled: false});
				}
				// check if tab is already open and if the tab has a different title
				else if ($scope.tabs.length == 2 && $scope.tabs[1].title != $scope.recipient) {
					$scope.tabs.splice(1);
					$scope.tabs.push({ title: $scope.recipient, content: $scope.message_objs, disabled: false});
				}
			};

		}
	}
	
})();