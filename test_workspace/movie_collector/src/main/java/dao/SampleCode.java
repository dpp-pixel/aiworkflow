package dao;

import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.HashMap;

import org.json.JSONArray;
import org.json.JSONObject;

import kr.or.kobis.kobisopenapi.consumer.rest.KobisOpenAPIRestService;
import model.MovieDetail;

import java.io.BufferedReader;
import java.io.IOException;

public class SampleCode {
	private static final String kobisKey = "041284459e696ebb9079338cd8731f74";
	private static KobisOpenAPIRestService kobis = new KobisOpenAPIRestService(kobisKey);

	public static void main(String[] args) throws IOException {
		MovieDetail result = null;
		KmdbApi kmdbapi = new KmdbApi();
		try {
			String urlAddress = "http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json";
			//연결 생성
			URL url = new URL(urlAddress);
			HttpURLConnection huc = (HttpURLConnection) url.openConnection();
			huc.setRequestMethod("GET");
			//JSON
			HashMap<String, String> infoMap = new HashMap<>();
			infoMap.put("key", kobisKey);
			infoMap.put("movieNm", "부산행");
			String response = kobis.getMovieList(true, infoMap);// 영화 상세 json
			System.out.println(response);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}
}
