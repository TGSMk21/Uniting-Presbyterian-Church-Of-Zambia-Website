// The visitor's position for "Find the nearest to me". It stays in the browser
// and is only used to sort the branch list.

const FIRST_TRY = { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 20000 };
// Some tablets only answer with GPS on, which is slower.
const SECOND_TRY = { enableHighAccuracy: true, maximumAge: 10 * 60 * 1000, timeout: 30000 };
const TIMEOUT = 3;

function ask(geolocation, options) {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      (error) => reject({ code: error?.code }),
      options,
    );
  });
}

export async function locate(geolocation) {
  if (!geolocation) throw { code: "unsupported" };
  try {
    return await ask(geolocation, FIRST_TRY);
  } catch (error) {
    if (error.code !== TIMEOUT) throw error;
    return ask(geolocation, SECOND_TRY);
  }
}

const MESSAGES = {
  1: "Location is blocked for this site. Allow it in your browser's site settings (tap the icon beside the address bar), then try again, or search by town instead.",
  2: "Your device couldn't find where you are. Check that location is turned on in your device's settings, then try again, or search by town instead.",
  3: "Finding your location took too long. Try again, or search by town instead.",
  unsupported: "Your browser can't share its location. Try searching by town instead.",
};

export function locationMessage(code) {
  return MESSAGES[code] || "We couldn't get your location. Try again, or search by town instead.";
}
