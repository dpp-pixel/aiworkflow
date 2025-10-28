package model;

import java.util.ArrayList;

import lombok.Data;

@Data
public class MovieDetail {

	//영화상세 : https://www.kobis.or.kr/kobisopenapi/homepg/apiservice/searchServiceInfo.do?serviceId=searchDailyBoxOffice
	//KMDB(http://api.koreafilm.or.kr/openapi-data2/wisenut/search_api/search_json2.jsp?collection=kmdb_new2&movieId=(이거뭔지모름))
	//영화목록(http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json)
	private String movieCd;//영화코드
	private String movieNm;//영화이름(국문)
	private String directors;//감독
	private String openDt;//개봉일
	private String showTm;//상영시간
	private String watchGradeNm;//관람등급
	private String posterSrc; //포스터 이미지
	private ArrayList<String> genreAlt;//전체 장르

}